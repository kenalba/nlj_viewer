/**
 * BranchEditor - Dropdown-based editor for branch conditions with expression builder and validation
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Chip,
  Paper,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Functions as ExpressionIcon,
  AccountTree as BranchIcon,
  Build as BuilderIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

import { ExpressionValidator } from '../../../components/ExpressionValidator';
import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode, BranchNode } from '../../../../types/nlj';
import { generateId } from '../../../utils/idGenerator';

interface BranchEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  availableNodes?: Array<{ id: string; name: string; type: string }>;
  availableVariables?: Array<{ id: string; name: string; type: 'number' | 'string' | 'boolean' }>;
  // New props for managing edges/links
  onAddEdge?: (sourceNodeId: string, targetNodeId: string, label?: string) => void;
  onRemoveEdge?: (sourceNodeId: string, targetNodeId: string) => void;
  onUpdateEdge?: (sourceNodeId: string, targetNodeId: string, updates: { label?: string }) => void;
}

interface BranchCondition {
  id: string;
  expression: string;
  targetNodeId: string;
  // Builder mode fields
  builderMode?: boolean;
  variable?: string;
  operator?: string;
  value?: string;
}

// Available operators for the builder
const OPERATORS = [
  { value: '==', label: 'equals (==)' },
  { value: '!=', label: 'not equals (!=)' },
  { value: '>', label: 'greater than (>)' },
  { value: '>=', label: 'greater than or equal (>=)' },
  { value: '<', label: 'less than (<)' },
  { value: '<=', label: 'less than or equal (<=)' },
];

export const BranchEditor: React.FC<BranchEditorProps> = ({
  node,
  onUpdate,
  availableNodes = [],
  availableVariables = [],
  onAddEdge,
  onRemoveEdge,
  onUpdateEdge,
}) => {
  const nljNode = node.data.nljNode as BranchNode;

  // Ensure we have valid conditions array
  const conditions = nljNode.conditions || [];
  const evaluationMode = nljNode.evaluationMode || 'first-match';
  const defaultTargetNodeId = nljNode.defaultTargetNodeId || '';

  const handleAddCondition = useCallback(() => {
    const newCondition: BranchCondition = {
      id: generateId(),
      expression: '',
      targetNodeId: '',
      builderMode: true,
      variable: '',
      operator: '==',
      value: '',
    };

    const updatedConditions = [...conditions, newCondition];
    onUpdate({ conditions: updatedConditions });
  }, [conditions, onUpdate]);

  // Build expression from builder mode fields
  const buildExpression = useCallback((condition: BranchCondition): string => {
    if (!condition.builderMode || !condition.variable || !condition.operator) {
      return condition.expression || '';
    }

    const { variable, operator, value } = condition;
    
    // Determine if value should be quoted (for strings)
    const variableInfo = availableVariables.find(v => v.name === variable);
    const shouldQuote = variableInfo?.type === 'string' && value && !value.startsWith('"') && !value.startsWith("'");
    const formattedValue = shouldQuote ? `"${value}"` : value || '';
    
    return `${variable} ${operator} ${formattedValue}`.trim();
  }, [availableVariables]);

  // Toggle between builder and manual mode
  const handleModeToggle = useCallback((conditionId: string, mode: 'builder' | 'manual') => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;

    let updatedCondition: BranchCondition;
    
    if (mode === 'builder') {
      // Switch to builder mode - try to parse existing expression
      updatedCondition = {
        ...condition,
        builderMode: true,
        variable: condition.variable || '',
        operator: condition.operator || '==',
        value: condition.value || '',
      };
    } else {
      // Switch to manual mode - build expression from current builder state
      const expression = buildExpression(condition);
      updatedCondition = {
        ...condition,
        builderMode: false,
        expression: expression || condition.expression,
      };
    }

    const updatedConditions = conditions.map(c => 
      c.id === conditionId ? updatedCondition : c
    );
    onUpdate({ conditions: updatedConditions });
  }, [conditions, onUpdate, buildExpression]);

  // Handle builder field updates
  const handleBuilderUpdate = useCallback((
    conditionId: string,
    field: 'variable' | 'operator' | 'value',
    value: string
  ) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;

    const updatedCondition = {
      ...condition,
      [field]: value,
    };

    // Auto-build expression when builder fields change
    updatedCondition.expression = buildExpression(updatedCondition);

    const updatedConditions = conditions.map(c => 
      c.id === conditionId ? updatedCondition : c
    );
    onUpdate({ conditions: updatedConditions });
  }, [conditions, onUpdate, buildExpression]);

  const handleUpdateCondition = useCallback((
    conditionId: string,
    field: keyof BranchCondition,
    value: string
  ) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;

    const oldTargetNodeId = condition.targetNodeId;
    const updatedCondition = { ...condition, [field]: value };
    const newTargetNodeId = updatedCondition.targetNodeId;

    // Handle target node changes - update edges
    if (field === 'targetNodeId' && oldTargetNodeId !== newTargetNodeId) {
      // Remove old edge if it existed
      if (oldTargetNodeId && onRemoveEdge) {
        onRemoveEdge(node.id, oldTargetNodeId);
      }
      
      // Add new edge if target is specified  
      if (newTargetNodeId && onAddEdge) {
        const label = updatedCondition.builderMode 
          ? `${updatedCondition.variable || 'condition'} ${updatedCondition.operator || '=='} ${updatedCondition.value || ''}`
          : updatedCondition.expression || 'condition';
        onAddEdge(node.id, newTargetNodeId, label.trim());
      }
    }

    // Handle expression/label changes - update edge labels
    if ((field === 'expression' || field === 'variable' || field === 'operator' || field === 'value') && 
        newTargetNodeId && onUpdateEdge) {
      const label = updatedCondition.builderMode 
        ? `${updatedCondition.variable || 'condition'} ${updatedCondition.operator || '=='} ${updatedCondition.value || ''}`
        : updatedCondition.expression || 'condition';
      onUpdateEdge(node.id, newTargetNodeId, { label: label.trim() });
    }

    const updatedConditions = conditions.map(condition =>
      condition.id === conditionId ? updatedCondition : condition
    );
    onUpdate({ conditions: updatedConditions });
  }, [conditions, onUpdate, node.id, onAddEdge, onRemoveEdge, onUpdateEdge]);

  const handleDeleteCondition = useCallback((conditionId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    
    // Remove associated edge if it exists
    if (condition?.targetNodeId && onRemoveEdge) {
      onRemoveEdge(node.id, condition.targetNodeId);
    }
    
    const updatedConditions = conditions.filter(condition => condition.id !== conditionId);
    onUpdate({ conditions: updatedConditions });
  }, [conditions, onUpdate, node.id, onRemoveEdge]);

  const handleEvaluationModeChange = useCallback((mode: 'first-match' | 'priority-order') => {
    onUpdate({ evaluationMode: mode });
  }, [onUpdate]);

  const handleDefaultTargetChange = useCallback((targetNodeId: string) => {
    const oldDefaultTarget = nljNode.defaultTargetNodeId;
    
    // Remove old default edge if it existed
    if (oldDefaultTarget && onRemoveEdge) {
      onRemoveEdge(node.id, oldDefaultTarget);
    }
    
    // Add new default edge if target is specified
    if (targetNodeId && onAddEdge) {
      onAddEdge(node.id, targetNodeId, 'default');
    }
    
    onUpdate({ defaultTargetNodeId: targetNodeId });
  }, [onUpdate, nljNode.defaultTargetNodeId, node.id, onAddEdge, onRemoveEdge]);

  // Create variable context for expression validation
  const variableContext = availableVariables.reduce((ctx, variable) => {
    ctx[variable.name] = variable.type === 'number' ? 0 : 
                        variable.type === 'boolean' ? false : '';
    return ctx;
  }, {} as Record<string, any>);

  const variableNames = availableVariables.map(v => v.name);

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Branch Conditions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Define conditions that determine which path to take through the scenario.
        </Typography>
      </Box>

      {/* Evaluation Mode */}
      <FormControl size="small">
        <InputLabel>Evaluation Mode</InputLabel>
        <Select
          value={evaluationMode}
          label="Evaluation Mode"
          onChange={(e) => handleEvaluationModeChange(e.target.value as 'first-match' | 'priority-order')}
        >
          <MenuItem value="first-match">First Match (stop at first true condition)</MenuItem>
          <MenuItem value="priority-order">Priority Order (evaluate all, use highest priority)</MenuItem>
        </Select>
      </FormControl>

      {/* Conditions List */}
      <Paper variant="outlined">
        {conditions.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No conditions defined. Click "Add Condition" to get started.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={0} divider={<Divider />}>
            {conditions.map((condition, index) => (
              <Box key={condition.id} sx={{ p: 2 }}>
                {/* Row 1: Priority, Mode Toggle, Actions */}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Chip 
                    label={index + 1} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                    sx={{ minWidth: 32 }}
                  />
                  
                  <ToggleButtonGroup
                    value={condition.builderMode ? 'builder' : 'manual'}
                    exclusive
                    onChange={(_, newMode) => {
                      if (newMode) handleModeToggle(condition.id, newMode);
                    }}
                    size="small"
                    sx={{ flex: 1 }}
                  >
                    <ToggleButton value="builder" aria-label="builder mode">
                      <BuilderIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Builder
                    </ToggleButton>
                    <ToggleButton value="manual" aria-label="manual mode">
                      <CodeIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Manual
                    </ToggleButton>
                  </ToggleButtonGroup>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteCondition(condition.id)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>

                {/* Row 2: Expression Builder or Manual Input */}
                <Box sx={{ mb: 2 }}>
                  {condition.builderMode ? (
                    // Builder Mode
                    <Stack spacing={2}>
                      <Typography variant="caption" color="text.secondary">
                        Build Expression:
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {/* Variable Dropdown */}
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Variable</InputLabel>
                          <Select
                            value={condition.variable || ''}
                            label="Variable"
                            onChange={(e) => handleBuilderUpdate(condition.id, 'variable', e.target.value)}
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

                        {/* Operator Dropdown */}
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Operator</InputLabel>
                          <Select
                            value={condition.operator || '=='}
                            label="Operator"
                            onChange={(e) => handleBuilderUpdate(condition.id, 'operator', e.target.value)}
                          >
                            {OPERATORS.map((op) => (
                              <MenuItem key={op.value} value={op.value}>
                                {op.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        {/* Value Input */}
                        <TextField
                          value={condition.value || ''}
                          onChange={(e) => handleBuilderUpdate(condition.id, 'value', e.target.value)}
                          placeholder="Value"
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Stack>

                      {/* Built Expression Preview */}
                      {condition.expression && (
                        <Alert severity="info" sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {condition.expression}
                          </Typography>
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    // Manual Mode
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Expression:
                      </Typography>
                      <ExpressionValidator
                        value={condition.expression || ''}
                        onChange={(value) => handleUpdateCondition(condition.id, 'expression', value)}
                        placeholder="e.g., score >= 80"
                        availableVariables={variableContext}
                        variableNames={variableNames}
                        size="small"
                        showVariables={false}
                        showSyntaxHelp={false}
                        fullWidth
                      />
                    </Box>
                  )}
                </Box>

                {/* Row 3: Target Node */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Target Node:
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={condition.targetNodeId}
                      onChange={(e) => handleUpdateCondition(condition.id, 'targetNodeId', e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        <em>Select target node</em>
                      </MenuItem>
                      {availableNodes.map((targetNode) => (
                        <MenuItem key={targetNode.id} value={targetNode.id}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">
                              {targetNode.name || targetNode.id}
                            </Typography>
                            <Chip label={targetNode.type} size="small" variant="outlined" />
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Add Condition Button */}
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAddCondition}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Condition
      </Button>

      {/* Default Target Node */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Default Target (Fallback)
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Default Node</InputLabel>
          <Select
            value={defaultTargetNodeId}
            label="Default Node"
            onChange={(e) => handleDefaultTargetChange(e.target.value)}
          >
            <MenuItem value="">
              <em>No default (end scenario)</em>
            </MenuItem>
            {availableNodes.map((targetNode) => (
              <MenuItem key={targetNode.id} value={targetNode.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    {targetNode.name || targetNode.id}
                  </Typography>
                  <Chip label={targetNode.type} size="small" variant="outlined" />
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          This node will be used if no conditions evaluate to true
        </Typography>
      </Box>

      {/* Instructions */}
      <Alert severity="info" icon={<BranchIcon />}>
        <Typography variant="body2">
          <strong>Branch Logic:</strong> Conditions are evaluated in order from top to bottom. 
          In "First Match" mode, navigation stops at the first true condition. 
          In "Priority Order" mode, all conditions are evaluated and the highest priority (topmost) true condition is used.
        </Typography>
      </Alert>

      {/* Variable Reference */}
      {availableVariables.length > 0 && (
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
                icon={<ExpressionIcon />}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default BranchEditor;