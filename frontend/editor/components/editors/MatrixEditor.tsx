/**
 * MatrixEditor - Editor for Matrix questions (grid-based questions)
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
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Radio,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode, MatrixNode } from '../../../../types/nlj';
import { FollowupEditor } from './FollowupEditor';

interface MatrixEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const MatrixEditor: React.FC<MatrixEditorProps> = ({
  node,
  onUpdate,
}) => {
  const nljNode = node.data.nljNode as MatrixNode;
  
  // Default values
  const rows = nljNode.rows || [];
  const columns = nljNode.columns || [];
  const matrixType = nljNode.matrixType || 'single';
  const required = nljNode.required || false;
  const allowMultiplePerRow = nljNode.allowMultiplePerRow || false;
  const randomizeRows = nljNode.randomizeRows || false;
  const randomizeColumns = nljNode.randomizeColumns || false;

  const addRow = () => {
    const newRow = {
      id: `row_${Date.now()}`,
      text: `Row ${rows.length + 1}`,
      required: false
    };
    onUpdate({ rows: [...rows, newRow] });
  };

  const updateRow = (index: number, updates: Partial<typeof rows[0]>) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...updates };
    onUpdate({ rows: newRows });
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    onUpdate({ rows: newRows });
  };

  const addColumn = () => {
    const newColumn = {
      id: `col_${Date.now()}`,
      text: `Column ${columns.length + 1}`,
      value: columns.length + 1,
      description: ''
    };
    onUpdate({ columns: [...columns, newColumn] });
  };

  const updateColumn = (index: number, updates: Partial<typeof columns[0]>) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], ...updates };
    onUpdate({ columns: newColumns });
  };

  const removeColumn = (index: number) => {
    const newColumns = columns.filter((_, i) => i !== index);
    onUpdate({ columns: newColumns });
  };

  const renderPreviewTable = () => {
    if (rows.length === 0 || columns.length === 0) {
      return (
        <Alert severity="info">
          Add rows and columns to see the matrix preview
        </Alert>
      );
    }

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Questions</TableCell>
              {columns.map((col) => (
                <TableCell key={col.id} align="center" sx={{ fontWeight: 'bold', minWidth: 80 }}>
                  {col.text}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell sx={{ fontWeight: 'medium' }}>
                  {row.text}
                  {row.required && (
                    <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                      *
                    </Typography>
                  )}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.id} align="center">
                    {matrixType === 'multiple' || allowMultiplePerRow ? (
                      <Checkbox size="small" disabled />
                    ) : (
                      <Radio size="small" disabled />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Matrix Configuration
      </Typography>

      {/* Matrix Type */}
      <FormControl size="small" fullWidth>
        <InputLabel>Matrix Type</InputLabel>
        <Select
          value={matrixType}
          onChange={(e) => onUpdate({ matrixType: e.target.value as 'single' | 'multiple' | 'rating' })}
          label="Matrix Type"
        >
          <MenuItem value="single">Single Choice per Row</MenuItem>
          <MenuItem value="multiple">Multiple Choice per Row</MenuItem>
          <MenuItem value="rating">Rating Scale</MenuItem>
        </Select>
      </FormControl>

      {/* Rows Configuration */}
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2" color="text.secondary">
            Rows (Questions)
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addRow}
          >
            Add Row
          </Button>
        </Stack>
        
        <Stack spacing={1}>
          {rows.map((row, index) => (
            <Stack key={row.id} direction="row" spacing={1} alignItems="center">
              <TextField
                value={row.text}
                onChange={(e) => updateRow(index, { text: e.target.value })}
                size="small"
                fullWidth
                placeholder={`Row ${index + 1} question`}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={row.required || false}
                    onChange={(e) => updateRow(index, { required: e.target.checked })}
                  />
                }
                label="Req"
                sx={{ minWidth: 60 }}
              />
              <IconButton
                size="small"
                color="error"
                onClick={() => removeRow(index)}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        
        {rows.length === 0 && (
          <Alert severity="info">
            Add rows to represent your matrix questions
          </Alert>
        )}
      </Stack>

      {/* Columns Configuration */}
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2" color="text.secondary">
            Columns (Response Options)
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addColumn}
          >
            Add Column
          </Button>
        </Stack>
        
        <Stack spacing={1}>
          {columns.map((column, index) => (
            <Stack key={column.id} spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  value={column.text}
                  onChange={(e) => updateColumn(index, { text: e.target.value })}
                  size="small"
                  fullWidth
                  placeholder={`Column ${index + 1} label`}
                />
                {matrixType === 'rating' && (
                  <TextField
                    label="Value"
                    type="number"
                    value={column.value || 0}
                    onChange={(e) => updateColumn(index, { value: parseInt(e.target.value) || 0 })}
                    size="small"
                    sx={{ width: 100 }}
                  />
                )}
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeColumn(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
              
              {/* Column Description */}
              <TextField
                value={column.description || ''}
                onChange={(e) => updateColumn(index, { description: e.target.value })}
                size="small"
                fullWidth
                placeholder="Optional description"
                multiline
                maxRows={2}
                sx={{ ml: 0 }}
              />
            </Stack>
          ))}
        </Stack>
        
        {columns.length === 0 && (
          <Alert severity="info">
            Add columns to represent your response options
          </Alert>
        )}
      </Stack>

      {/* Preview */}
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Matrix Preview:
        </Typography>
        
        {renderPreviewTable()}
      </Box>

      {/* Additional Options */}
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
            />
          }
          label="All Questions Required"
        />

        {matrixType === 'single' && (
          <FormControlLabel
            control={
              <Switch
                checked={allowMultiplePerRow}
                onChange={(e) => onUpdate({ allowMultiplePerRow: e.target.checked })}
              />
            }
            label="Allow Multiple Selections per Row"
          />
        )}

        <FormControlLabel
          control={
            <Switch
              checked={randomizeRows}
              onChange={(e) => onUpdate({ randomizeRows: e.target.checked })}
            />
          }
          label="Randomize Row Order"
        />

        <FormControlLabel
          control={
            <Switch
              checked={randomizeColumns}
              onChange={(e) => onUpdate({ randomizeColumns: e.target.checked })}
            />
          }
          label="Randomize Column Order"
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
          Matrix questions are perfect for collecting multiple responses using the same scale. 
          Each row represents a question, and each column represents a response option.
        </Typography>
      </Alert>
    </Stack>
  );
};