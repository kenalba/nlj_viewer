/**
 * Variable Browser Modal for managing activity-level variables
 * Located in Flow Editor header between History and Settings icons
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  Stack,
  Alert,
  Checkbox,
  FormControlLabel,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Functions as VariablesIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

import type { VariableDefinition, NLJScenario } from '../../types/nlj';

interface VariableBrowserModalProps {
  open: boolean;
  onClose: () => void;
  scenario: NLJScenario;
  onScenarioChange: (scenario: NLJScenario) => void;
}

interface NewVariableForm {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: number | string | boolean;
  description: string;
  allowRuntimeOverride: boolean;
}

const DEFAULT_NEW_VARIABLE: NewVariableForm = {
  name: '',
  type: 'number',
  defaultValue: 0,
  description: '',
  allowRuntimeOverride: true,
};

export const VariableBrowserModal: React.FC<VariableBrowserModalProps> = ({
  open,
  onClose,
  scenario,
  onScenarioChange,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [newVariable, setNewVariable] = useState<NewVariableForm>(DEFAULT_NEW_VARIABLE);
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [allowRuntimeParameters, setAllowRuntimeParameters] = useState(true);

  const variables = scenario.variableDefinitions || [];

  // Get default value for variable type
  const getDefaultValueForType = useCallback((type: 'number' | 'string' | 'boolean') => {
    switch (type) {
      case 'number': return 0;
      case 'string': return '';
      case 'boolean': return false;
      default: return 0;
    }
  }, []);

  // Handle adding new variable
  const handleAddVariable = useCallback(() => {
    if (!newVariable.name.trim()) return;

    const newVariableDefinition: VariableDefinition = {
      id: crypto.randomUUID(),
      name: newVariable.name.trim(),
      type: newVariable.type,
      defaultValue: newVariable.defaultValue,
      description: newVariable.description,
      allowRuntimeOverride: newVariable.allowRuntimeOverride,
    };

    const updatedScenario = {
      ...scenario,
      variableDefinitions: [...variables, newVariableDefinition],
    };

    onScenarioChange(updatedScenario);
    setNewVariable(DEFAULT_NEW_VARIABLE);
    setShowAddForm(false);
  }, [newVariable, scenario, variables, onScenarioChange]);

  // Handle editing variable
  const handleEditVariable = useCallback((variableId: string, updates: Partial<VariableDefinition>) => {
    const updatedVariables = variables.map(variable =>
      variable.id === variableId ? { ...variable, ...updates } : variable
    );

    const updatedScenario = {
      ...scenario,
      variableDefinitions: updatedVariables,
    };

    onScenarioChange(updatedScenario);
    setEditingVariable(null);
  }, [variables, scenario, onScenarioChange]);

  // Handle deleting variable
  const handleDeleteVariable = useCallback((variableId: string) => {
    const updatedVariables = variables.filter(variable => variable.id !== variableId);

    const updatedScenario = {
      ...scenario,
      variableDefinitions: updatedVariables,
    };

    onScenarioChange(updatedScenario);
  }, [variables, scenario, onScenarioChange]);

  // Handle type change in new variable form
  const handleTypeChange = useCallback((type: 'number' | 'string' | 'boolean') => {
    setNewVariable(prev => ({
      ...prev,
      type,
      defaultValue: getDefaultValueForType(type),
    }));
  }, [getDefaultValueForType]);

  // Variable type color mapping
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'number': return 'primary';
      case 'string': return 'success';
      case 'boolean': return 'warning';
      default: return 'default';
    }
  };

  // Variable type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'number': return '123';
      case 'string': return 'Aa';
      case 'boolean': return '●';
      default: return '?';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <VariablesIcon color="primary" />
          <Typography variant="h6">Activity Variables</Typography>
          <Chip
            label={`${variables.length} variables`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Variables" />
          <Tab label="Parameters" />
          <Tab label="Usage Examples" />
        </Tabs>

        {/* Variables Tab */}
        {activeTab === 0 && (
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" mb={2}>Current Variables</Typography>

            {/* Empty state message if no variables */}
            {variables.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                No variables defined yet. Click "Add variable" below to get started with expressions and branching logic.
              </Alert>
            )}

            {/* Variables Table with Add Row */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="30%">Name</TableCell>
                    <TableCell width="15%">Type</TableCell>
                    <TableCell width="20%">Default</TableCell>
                    <TableCell width="25%">Description</TableCell>
                    <TableCell width="10%">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Existing Variables */}
                  {variables.map((variable) => (
                    <TableRow key={variable.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={getTypeIcon(variable.type)}
                            size="small"
                            color={getTypeColor(variable.type) as any}
                            sx={{ minWidth: 32, fontSize: '0.75rem' }}
                          />
                          <Typography variant="body2" fontWeight="medium">
                            {variable.name}
                          </Typography>
                          {variable.allowRuntimeOverride && (
                            <Chip
                              label="URL"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 20 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={variable.type}
                          size="small"
                          color={getTypeColor(variable.type) as any}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {String(variable.defaultValue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {variable.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => setEditingVariable(variable.id)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteVariable(variable.id)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Add Variable Row */}
                  {showAddForm ? (
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell>
                        <TextField
                          value={newVariable.name}
                          onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Variable name"
                          size="small"
                          fullWidth
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={newVariable.type}
                            onChange={(e) => handleTypeChange(e.target.value as 'number' | 'string' | 'boolean')}
                            displayEmpty
                          >
                            <MenuItem value="number">Number</MenuItem>
                            <MenuItem value="string">String</MenuItem>
                            <MenuItem value="boolean">Boolean</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={newVariable.defaultValue}
                          onChange={(e) => {
                            let value: number | string | boolean = e.target.value;
                            if (newVariable.type === 'number') {
                              value = parseFloat(e.target.value) || 0;
                            } else if (newVariable.type === 'boolean') {
                              value = e.target.value === 'true';
                            }
                            setNewVariable(prev => ({ ...prev, defaultValue: value }));
                          }}
                          type={newVariable.type === 'number' ? 'number' : 'text'}
                          size="small"
                          fullWidth
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={newVariable.description}
                          onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Description"
                          size="small"
                          fullWidth
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="Save Variable">
                            <span>
                              <IconButton
                                size="small"
                                onClick={handleAddVariable}
                                disabled={!newVariable.name.trim()}
                                color="primary"
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setShowAddForm(false);
                                setNewVariable(DEFAULT_NEW_VARIABLE);
                              }}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow 
                      hover 
                      sx={{ 
                        cursor: 'pointer',
                        backgroundColor: 'action.selected',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        }
                      }}
                      onClick={() => setShowAddForm(true)}
                    >
                      <TableCell colSpan={5}>
                        <Box display="flex" alignItems="center" gap={1} sx={{ color: 'text.secondary' }}>
                          <AddIcon fontSize="small" />
                          <Typography variant="body2">
                            Add variable
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* URL Override Option */}
            {showAddForm && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newVariable.allowRuntimeOverride}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, allowRuntimeOverride: e.target.checked }))}
                      size="small"
                    />
                  }
                  label="Allow runtime override (can be set via URL parameters)"
                />
              </Box>
            )}
          </Box>
        )}

        {/* Parameters Tab */}
        {activeTab === 1 && (
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Runtime Parameters
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={allowRuntimeParameters}
                  onChange={(e) => setAllowRuntimeParameters(e.target.checked)}
                />
              }
              label="Accept parameters from URL"
            />
            
            <Alert severity="info" sx={{ mt: 2 }}>
              When enabled, variables can be set via URL parameters when the activity is played.
              Example: <code>/app/play/123?score=85&userRole=admin</code>
            </Alert>

            {variables.filter(v => v.allowRuntimeOverride).length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Variables accepting URL parameters:
                </Typography>
                <List dense>
                  {variables
                    .filter(v => v.allowRuntimeOverride)
                    .map((variable) => (
                      <ListItem key={variable.id}>
                        <ListItemText
                          primary={variable.name}
                          secondary={`Type: ${variable.type}, Default: ${variable.defaultValue}`}
                        />
                        <Chip
                          label={variable.type}
                          size="small"
                          color={getTypeColor(variable.type) as any}
                          variant="outlined"
                        />
                      </ListItem>
                    ))}
                </List>
              </Box>
            )}
          </Box>
        )}

        {/* Usage Examples Tab */}
        {activeTab === 2 && (
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Usage Examples
            </Typography>
            
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Branch Node Conditions
                </Typography>
                <Alert severity="success">
                  Use variables in Branch nodes to route users down different paths:
                  <br />• High performers: <code>score &gt;= 80</code>
                  <br />• Admins: <code>userRole === "admin"</code>
                  <br />• First time: <code>attempts === 1</code>
                </Alert>
              </Box>

              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Variable Changes in Nodes
                </Typography>
                <Alert severity="info">
                  Modify variables when users complete nodes:
                  <br />• Add points: <code>score + 10</code>
                  <br />• Track attempts: <code>attempts + 1</code>
                  <br />• Set completion: <code>completed = true</code>
                </Alert>
              </Box>

              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  URL Parameters
                </Typography>
                <Alert severity="warning">
                  Set initial values when sharing activities:
                  <br />• <code>?score=50</code> - Start with 50 points
                  <br />• <code>?userRole=manager</code> - Set user role
                  <br />• <code>?completed=true</code> - Mark as completed
                </Alert>
              </Box>
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};