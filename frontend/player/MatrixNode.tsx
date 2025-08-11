import React, { useState, useEffect, useCallback } from 'react';
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
  FormHelperText,
  Paper,
  useMediaQuery
} from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import type { MatrixNode as MatrixNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { UnifiedSurveyQuestionNode } from './UnifiedSurveyQuestionNode';
import { useAudio } from '../contexts/AudioContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface MatrixNodeProps {
  question: MatrixNodeType;
  onAnswer: (response: Record<string, string | string[]>) => void;
}

export const MatrixNode: React.FC<MatrixNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const { playSound } = useAudio();
  const muiTheme = useMuiTheme();

  if (import.meta.env.DEV) {
    console.log(`MatrixNode ${question.id}: shuffleAnswerOrder=${settings.shuffleAnswerOrder}, reinforcementEligible=${settings.reinforcementEligible}`);
  }
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const handleSingleResponse = (rowId: string, columnId: string) => {
    setResponses(prev => ({
      ...prev,
      [rowId]: columnId
    }));
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
    playSound('click');
  };

  const hasValidResponse = (): boolean => {
    if (!question.required) return true;
    
    for (const row of question.rows) {
      if (row.required !== false) {
        const response = responses[row.id];
        if (!response || 
            (Array.isArray(response) && response.length === 0) ||
            (typeof response === 'string' && response.trim().length === 0)) {
          return false;
        }
      }
    }
    
    return true;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard events when this component is active
      if (event.target !== document.body) return;
      
      const currentRow = question.rows[currentRowIndex];
      if (!currentRow) return;
      
      // Handle number keys (1-9) for column selection
      if (event.key >= '1' && event.key <= '9') {
        const keyValue = parseInt(event.key, 10);
        const columnIndex = keyValue - 1;
        
        if (columnIndex < question.columns.length) {
          event.preventDefault();
          const column = question.columns[columnIndex];
          
          if (question.matrixType === 'multiple') {
            // For multiple selection, toggle the checkbox
            const currentResponses = (responses[currentRow.id] as string[]) || [];
            const isSelected = currentResponses.includes(column.id);
            handleMultipleResponse(currentRow.id, column.id, !isSelected);
          } else {
            // For single selection, select the radio button
            handleSingleResponse(currentRow.id, column.id);
          }
          
          // Move to next row after selection
          if (currentRowIndex < question.rows.length - 1) {
            setCurrentRowIndex(currentRowIndex + 1);
          }
        }
      }
      
      // Handle arrow keys for row navigation
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (event.key === 'ArrowUp' && currentRowIndex > 0) {
          setCurrentRowIndex(currentRowIndex - 1);
        } else if (event.key === 'ArrowDown' && currentRowIndex < question.rows.length - 1) {
          setCurrentRowIndex(currentRowIndex + 1);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentRowIndex, question, responses, handleSingleResponse, handleMultipleResponse]);

  const renderTableHeader = () => (
    <TableHead>
      <TableRow>
        <TableCell sx={{ 
          fontWeight: 'bold', 
          borderBottom: '2px solid',
          borderColor: 'divider',
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
              borderColor: 'divider',
              minWidth: isMobile ? 80 : 100,
            }}
          >
            <MarkdownRenderer content={column.text} />
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );

  const renderSingleSelectRow = (row: typeof question.rows[0], rowIndex: number) => (
    <TableRow 
      key={row.id}
      sx={{
        backgroundColor: currentRowIndex === rowIndex ? 'action.hover' : 'transparent',
        transition: 'background-color 0.2s ease',
      }}
    >
      <TableCell sx={{ 
        fontWeight: 'medium',
        borderColor: 'divider',
      }}>
        <MarkdownRenderer content={row.text} />
        {row.required !== false && (
          <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
            *
          </Typography>
        )}
        {currentRowIndex === rowIndex && (
          <Typography component="span" sx={{ ml: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
            (active)
          </Typography>
        )}
      </TableCell>
      {question.columns.map((column) => (
        <TableCell 
          key={column.id}
          align="center"
          sx={{ 
            borderColor: 'divider',
          }}
        >
          <Radio
            checked={responses[row.id] === column.id}
            onChange={() => handleSingleResponse(row.id, column.id)}
            sx={{
              color: 'action.disabled',
              '&.Mui-checked': {
                color: 'primary.main',
              },
            }}
          />
        </TableCell>
      ))}
    </TableRow>
  );

  const renderMultipleSelectRow = (row: typeof question.rows[0], rowIndex: number) => (
    <TableRow 
      key={row.id}
      sx={{
        backgroundColor: currentRowIndex === rowIndex ? 'action.hover' : 'transparent',
        transition: 'background-color 0.2s ease',
      }}
    >
      <TableCell sx={{ 
        fontWeight: 'medium',
        borderColor: 'divider',
      }}>
        <MarkdownRenderer content={row.text} />
        {row.required !== false && (
          <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
            *
          </Typography>
        )}
        {currentRowIndex === rowIndex && (
          <Typography component="span" sx={{ ml: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
            (active)
          </Typography>
        )}
      </TableCell>
      {question.columns.map((column) => (
        <TableCell 
          key={column.id}
          align="center"
          sx={{ 
            borderColor: 'divider',
          }}
        >
          <Checkbox
            checked={((responses[row.id] as string[]) || []).includes(column.id)}
            onChange={(e) => handleMultipleResponse(row.id, column.id, e.target.checked)}
            sx={{
              color: 'action.disabled',
              '&.Mui-checked': {
                color: 'primary.main',
              },
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
        borderRadius: 2,
        overflow: 'auto',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Table size={isMobile ? 'small' : 'medium'}>
        {renderTableHeader()}
        <TableBody>
          {question.rows.map((row, index) => {
            if (question.matrixType === 'multiple') {
              return renderMultipleSelectRow(row, index);
            } else {
              return renderSingleSelectRow(row, index);
            }
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderMobileCards = () => (
    <Box sx={{ mb: 3 }}>
      {question.rows.map((row, index) => (
        <Paper
          key={row.id}
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: currentRowIndex === index ? 'action.hover' : 'background.paper',
            transition: 'background-color 0.2s ease',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ mb: 2, fontWeight: 'medium', color: 'text.primary' }}>
            {row.text}
            {row.required !== false && (
              <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
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
                        color: 'action.disabled',
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={<Typography color="text.primary">{column.text}</Typography>}
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
                        color: 'action.disabled',
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={<Typography color="text.primary">{column.text}</Typography>}
                />
              ))}
            </RadioGroup>
          )}
        </Paper>
      ))}
    </Box>
  );

  // Pure render function for the matrix question UI
  const renderMatrixQuestion = () => (
    <NodeCard animate={true}>
      <Box sx={{ mb: 3 }}>
        {question.media && (
          <Box sx={{ mb: 3 }}>
            <MediaViewer media={question.media} size="medium" />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 3 }}>
            {question.additionalMediaList.map((wrapper, index) => (
              <Box key={`${wrapper.media.id}-${index}`} sx={{ mb: 2 }}>
                <MediaViewer media={wrapper.media} size="small" />
              </Box>
            ))}
          </Box>
        )}
        
        <MarkdownRenderer
          content={question.text}
          sx={{ mb: 1, color: 'text.primary' }}
        />
        
        {question.content && (
          <MarkdownRenderer
            content={question.content}
            sx={{ mb: 2, color: 'text.secondary' }}
          />
        )}
      </Box>

      {/* Matrix Table or Mobile Cards */}
      {isMobile ? renderMobileCards() : renderTable()}

      {/* Helper Text */}
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        {question.required && (
          <FormHelperText sx={{ mb: 0.5 }}>
            * Required questions are marked with an asterisk
          </FormHelperText>
        )}
        <FormHelperText sx={{ fontSize: '0.75rem', opacity: 0.7 }}>
          Use number keys (1-{question.columns.length}) for column selection • Arrow keys to navigate rows • Enter to submit
        </FormHelperText>
      </Box>
    </NodeCard>
  );

  // Check if this is a survey question (has followUp capability)
  const isSurveyQuestion = question.followUp !== undefined;

  // If it's a survey question, wrap with UnifiedSurveyQuestionNode
  if (isSurveyQuestion) {
    return (
      <UnifiedSurveyQuestionNode
        question={question}
        onAnswer={onAnswer}
        response={responses}
        hasResponse={hasValidResponse()}
      >
        {renderMatrixQuestion()}
      </UnifiedSurveyQuestionNode>
    );
  }

  // Otherwise render as regular training question with submit button
  return (
    <Box>
      {renderMatrixQuestion()}
      
      {/* Submit Button for non-survey questions */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          onClick={() => onAnswer(responses)}
          size="large"
          disabled={question.required && !hasValidResponse()}
          sx={{
            borderRadius: 3,
            minWidth: 120,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&:disabled': {
              backgroundColor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          Submit
        </Button>
      </Box>
    </Box>
  );
};