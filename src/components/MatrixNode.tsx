import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  FormHelperText,
  Paper,
  useMediaQuery
} from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import type { MatrixNode as MatrixNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';

interface MatrixNodeProps {
  question: MatrixNodeType;
  onAnswer: (response: Record<string, string | string[]>) => void;
}

export const MatrixNode: React.FC<MatrixNodeProps> = ({ question, onAnswer }) => {
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [showValidation, setShowValidation] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const { playSound } = useAudio();
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const handleSingleResponse = (rowId: string, columnId: string) => {
    setResponses(prev => ({
      ...prev,
      [rowId]: columnId
    }));
    setShowValidation(false);
    setValidationError('');
    playSound('click');
  };

  const handleMultipleResponse = (rowId: string, columnId: string, checked: boolean) => {
    setResponses(prev => {
      const currentResponses = (prev[rowId] as string[]) || [];
      let newResponses: string[];
      
      if (checked) {
        newResponses = [...currentResponses, columnId];
      } else {
        newResponses = currentResponses.filter(id => id !== columnId);
      }
      
      return {
        ...prev,
        [rowId]: newResponses
      };
    });
    setShowValidation(false);
    setValidationError('');
    playSound('click');
  };

  const validateResponses = (): string | null => {
    if (!question.required) return null;
    
    for (const row of question.rows) {
      if (row.required !== false) {
        const response = responses[row.id];
        if (!response || 
            (Array.isArray(response) && response.length === 0) ||
            (typeof response === 'string' && response.trim().length === 0)) {
          return `Please provide a response for "${row.text}".`;
        }
      }
    }
    
    return null;
  };

  const handleSubmit = () => {
    const error = validateResponses();
    
    if (error) {
      setValidationError(error);
      setShowValidation(true);
      playSound('error');
      return;
    }

    playSound('navigate');
    onAnswer(responses);
  };

  const renderTableHeader = () => (
    <TableHead>
      <TableRow>
        <TableCell sx={{ 
          fontWeight: 'bold', 
          borderBottom: '2px solid',
          borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider',
          backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.default',
          color: themeMode === 'unfiltered' ? '#FFFFFF' : 'text.primary',
        }}>
          {/* Empty cell for row labels */}
        </TableCell>
        {question.columns.map((column) => (
          <TableCell 
            key={column.id}
            align="center"
            sx={{ 
              fontWeight: 'bold',
              borderBottom: '2px solid',
              borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider',
              backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.default',
              color: themeMode === 'unfiltered' ? '#FFFFFF' : 'text.primary',
              minWidth: isMobile ? 80 : 100,
            }}
          >
            {column.text}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );

  const renderSingleSelectRow = (row: typeof question.rows[0]) => (
    <TableRow key={row.id}>
      <TableCell sx={{ 
        fontWeight: 'medium',
        borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider',
        backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.paper',
        color: themeMode === 'unfiltered' ? '#FFFFFF' : 'text.primary',
      }}>
        {row.text}
        {row.required !== false && (
          <Typography component="span" color="error" sx={{ ml: 0.5 }}>
            *
          </Typography>
        )}
      </TableCell>
      {question.columns.map((column) => (
        <TableCell 
          key={column.id}
          align="center"
          sx={{ 
            borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider',
            backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.paper',
          }}
        >
          <Radio
            checked={responses[row.id] === column.id}
            onChange={() => handleSingleResponse(row.id, column.id)}
            sx={{
              ...(themeMode === 'unfiltered' && {
                color: '#666666',
                '&.Mui-checked': {
                  color: '#F6FA24',
                },
              }),
            }}
          />
        </TableCell>
      ))}
    </TableRow>
  );

  const renderMultipleSelectRow = (row: typeof question.rows[0]) => (
    <TableRow key={row.id}>
      <TableCell sx={{ 
        fontWeight: 'medium',
        borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider',
        backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.paper',
        color: themeMode === 'unfiltered' ? '#FFFFFF' : 'text.primary',
      }}>
        {row.text}
        {row.required !== false && (
          <Typography component="span" color="error" sx={{ ml: 0.5 }}>
            *
          </Typography>
        )}
      </TableCell>
      {question.columns.map((column) => (
        <TableCell 
          key={column.id}
          align="center"
          sx={{ 
            borderColor: themeMode === 'unfiltered' ? '#333333' : 'divider',
            backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.paper',
          }}
        >
          <Checkbox
            checked={((responses[row.id] as string[]) || []).includes(column.id)}
            onChange={(e) => handleMultipleResponse(row.id, column.id, e.target.checked)}
            sx={{
              ...(themeMode === 'unfiltered' && {
                color: '#666666',
                '&.Mui-checked': {
                  color: '#F6FA24',
                },
              }),
            }}
          />
        </TableCell>
      ))}
    </TableRow>
  );

  const renderTable = () => (
    <TableContainer 
      component={Paper} 
      sx={{ 
        mb: 3,
        backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.paper',
        borderRadius: 2,
        overflow: 'auto',
        border: themeMode === 'unfiltered' ? '1px solid #333333' : 'none',
      }}
    >
      <Table size={isMobile ? 'small' : 'medium'}>
        {renderTableHeader()}
        <TableBody>
          {question.rows.map((row) => {
            if (question.matrixType === 'multiple') {
              return renderMultipleSelectRow(row);
            } else {
              return renderSingleSelectRow(row);
            }
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderMobileCards = () => (
    <Box sx={{ mb: 3 }}>
      {question.rows.map((row) => (
        <Paper
          key={row.id}
          sx={{
            mb: 2,
            p: 2,
            backgroundColor: themeMode === 'unfiltered' ? '#1A1A1A' : 'background.paper',
            border: themeMode === 'unfiltered' ? '1px solid #333333' : 'none',
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
            {row.text}
            {row.required !== false && (
              <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                *
              </Typography>
            )}
          </Typography>
          
          {question.matrixType === 'multiple' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {question.columns.map((column) => (
                <FormControlLabel
                  key={column.id}
                  control={
                    <Checkbox
                      checked={((responses[row.id] as string[]) || []).includes(column.id)}
                      onChange={(e) => handleMultipleResponse(row.id, column.id, e.target.checked)}
                      sx={{
                        ...(themeMode === 'unfiltered' && {
                          color: '#666666',
                          '&.Mui-checked': {
                            color: '#F6FA24',
                          },
                        }),
                      }}
                    />
                  }
                  label={column.text}
                />
              ))}
            </Box>
          ) : (
            <RadioGroup
              value={responses[row.id] || ''}
              onChange={(e) => handleSingleResponse(row.id, e.target.value)}
            >
              {question.columns.map((column) => (
                <FormControlLabel
                  key={column.id}
                  value={column.id}
                  control={
                    <Radio
                      sx={{
                        ...(themeMode === 'unfiltered' && {
                          color: '#666666',
                          '&.Mui-checked': {
                            color: '#F6FA24',
                          },
                        }),
                      }}
                    />
                  }
                  label={column.text}
                />
              ))}
            </RadioGroup>
          )}
        </Paper>
      ))}
    </Box>
  );

  return (
    <NodeCard variant="question" animate={true}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {question.text}
        </Typography>
        
        {question.content && (
          <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
            {question.content}
          </Typography>
        )}
        
        {question.media && (
          <Box sx={{ mb: 3 }}>
            <MediaViewer media={question.media} size="medium" />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 3 }}>
            {question.additionalMediaList.map((media, index) => (
              <Box key={`${media.id}-${index}`} sx={{ mb: 2 }}>
                <MediaViewer media={media} size="small" />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Matrix Table or Mobile Cards */}
      {isMobile ? renderMobileCards() : renderTable()}

      {/* Validation Error */}
      {showValidation && validationError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {validationError}
        </Alert>
      )}

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          size="large"
          sx={{
            borderRadius: 3,
            minWidth: 120,
            ...(themeMode === 'unfiltered' && {
              backgroundColor: '#F6FA24',
              color: '#000000',
              '&:hover': {
                backgroundColor: '#FFD700',
              },
            }),
          }}
        >
          Submit
        </Button>
      </Box>

      {/* Helper Text */}
      {question.required && (
        <FormHelperText sx={{ textAlign: 'center', mt: 1 }}>
          * Required questions are marked with an asterisk
        </FormHelperText>
      )}
    </NodeCard>
  );
};