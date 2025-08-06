/**
 * CrosswordNode Component
 * Interactive crossword puzzle game with real-time validation and xAPI tracking
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Refresh,
  Lightbulb,
  CheckCircle,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { useGameEngine } from '../hooks/useGameEngine';
import { useXAPI } from '../contexts/XAPIContext';
import { useAudio } from '../contexts/AudioContext';
import {
  CrosswordNode as CrosswordNodeType,
  CrosswordCell,
  CrosswordClue,
  CrosswordGuess,
  calculateCrosswordScore
} from '../types/nlj';

interface CrosswordNodeProps {
  node: CrosswordNodeType;
  onContinue: (response: any) => void;
}

interface CrosswordGameState {
  grid: CrosswordCell[][];
  selectedClue: CrosswordClue | null;
  selectedCell: { row: number; col: number } | null;
  guesses: CrosswordGuess[];
  completedWords: Set<number>;
  isComplete: boolean;
  timeStarted: Date;
  hintsUsed: number;
}

export const CrosswordNode: React.FC<CrosswordNodeProps> = ({ node, onContinue }) => {
  const { trackEvent } = useXAPI();
  const { playSound } = useAudio();
  const { currentNode, updateResponse } = useGameEngine();
  
  // Timer ref for tracking play time
  const timerRef = useRef<NodeJS.Timeout>();
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // Initialize game state
  const [gameState, setGameState] = useState<CrosswordGameState>(() => {
    // Deep clone the grid from node data
    const initialGrid = node.gameSettings.grid.map(row => 
      row.map(cell => ({ ...cell, userInput: cell.userInput || '' }))
    );
    
    return {
      grid: initialGrid,
      selectedClue: null,
      selectedCell: null,
      guesses: [],
      completedWords: new Set(),
      isComplete: false,
      timeStarted: new Date(),
      hintsUsed: 0
    };
  });

  // Separate clues by direction for display
  const acrossClues = node.gameSettings.clues.filter(clue => clue.direction === 'across');
  const downClues = node.gameSettings.clues.filter(clue => clue.direction === 'down');

  // Timer effect
  useEffect(() => {
    if (!gameState.isComplete) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState.isComplete]);

  // Track game start
  useEffect(() => {
    trackEvent('crossword_started', {
      nodeId: node.id,
      gridSize: node.gameSettings.gridSize,
      totalWords: node.gameSettings.clues.length,
      difficulty: node.gameSettings.difficultyLevel
    });
  }, []);

  // Check if a word is complete
  const checkWordCompletion = useCallback((clue: CrosswordClue, grid: CrosswordCell[][]) => {
    let isComplete = true;
    let currentWord = '';
    
    for (let i = 0; i < clue.length; i++) {
      const row = clue.direction === 'across' ? clue.startRow : clue.startRow + i;
      const col = clue.direction === 'across' ? clue.startCol + i : clue.startCol;
      
      const cell = grid[row]?.[col];
      if (!cell || !cell.userInput || cell.userInput.toUpperCase() !== clue.answer[i].toUpperCase()) {
        isComplete = false;
      }
      currentWord += cell?.userInput || '';
    }
    
    return { isComplete, currentWord };
  }, []);

  // Check all words and update completion status
  const checkAllWords = useCallback((grid: CrosswordCell[][]) => {
    const newCompletedWords = new Set<number>();
    let allComplete = true;
    
    node.gameSettings.clues.forEach(clue => {
      const { isComplete } = checkWordCompletion(clue, grid);
      if (isComplete) {
        newCompletedWords.add(clue.number);
      } else {
        allComplete = false;
      }
    });
    
    return { completedWords: newCompletedWords, allComplete };
  }, [node.gameSettings.clues, checkWordCompletion]);

  // Handle cell input
  const handleCellInput = useCallback((row: number, col: number, value: string) => {
    if (value.length > 1) return; // Only allow single characters
    
    setGameState(prevState => {
      const newGrid = prevState.grid.map((gridRow, r) =>
        gridRow.map((cell, c) => {
          if (r === row && c === col) {
            return { ...cell, userInput: value.toUpperCase() };
          }
          return cell;
        })
      );
      
      const { completedWords, allComplete } = checkAllWords(newGrid);
      
      // Track newly completed words
      completedWords.forEach(wordNumber => {
        if (!prevState.completedWords.has(wordNumber)) {
          playSound('success');
          trackEvent('crossword_word_completed', {
            nodeId: node.id,
            wordNumber,
            timeElapsed: Math.floor((Date.now() - prevState.timeStarted.getTime()) / 1000)
          });
        }
      });
      
      // Check if game is complete
      if (allComplete && !prevState.isComplete) {
        playSound('gameComplete');
        trackEvent('crossword_completed', {
          nodeId: node.id,
          totalWords: node.gameSettings.clues.length,
          completedWords: completedWords.size,
          timeElapsed: Math.floor((Date.now() - prevState.timeStarted.getTime()) / 1000),
          hintsUsed: prevState.hintsUsed
        });
      }
      
      return {
        ...prevState,
        grid: newGrid,
        completedWords,
        isComplete: allComplete
      };
    });
  }, [checkAllWords, playSound, trackEvent, node.id, node.gameSettings.clues.length]);

  // Handle clue selection
  const handleClueSelect = useCallback((clue: CrosswordClue) => {
    setGameState(prevState => ({
      ...prevState,
      selectedClue: clue,
      selectedCell: { row: clue.startRow, col: clue.startCol }
    }));
    
    trackEvent('crossword_clue_selected', {
      nodeId: node.id,
      clueNumber: clue.number,
      direction: clue.direction
    });
  }, [trackEvent, node.id]);

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    const cell = gameState.grid[row][col];
    if (cell.isBlocked) return;
    
    setGameState(prevState => ({
      ...prevState,
      selectedCell: { row, col }
    }));
  }, [gameState.grid]);

  // Handle hint request
  const handleHint = useCallback(() => {
    if (!gameState.selectedClue) return;
    
    const clue = gameState.selectedClue;
    let hintGiven = false;
    
    setGameState(prevState => {
      const newGrid = [...prevState.grid];
      
      // Find first empty cell in selected word
      for (let i = 0; i < clue.length; i++) {
        const row = clue.direction === 'across' ? clue.startRow : clue.startRow + i;
        const col = clue.direction === 'across' ? clue.startCol + i : clue.startCol;
        
        if (!newGrid[row][col].userInput) {
          newGrid[row][col].userInput = clue.answer[i].toUpperCase();
          hintGiven = true;
          break;
        }
      }
      
      if (hintGiven) {
        playSound('hint');
        trackEvent('crossword_hint_used', {
          nodeId: node.id,
          clueNumber: clue.number,
          direction: clue.direction
        });
      }
      
      const { completedWords, allComplete } = checkAllWords(newGrid);
      
      return {
        ...prevState,
        grid: newGrid,
        completedWords,
        isComplete: allComplete,
        hintsUsed: hintGiven ? prevState.hintsUsed + 1 : prevState.hintsUsed
      };
    });
  }, [gameState.selectedClue, playSound, trackEvent, node.id, checkAllWords]);

  // Handle continue/submit
  const handleContinue = useCallback(() => {
    const response = {
      guesses: gameState.guesses,
      completedWords: gameState.completedWords.size,
      totalWords: node.gameSettings.clues.length,
      completed: gameState.isComplete
    };
    
    const score = calculateCrosswordScore(response, node.scoring);
    
    updateResponse(node.id, response);
    
    trackEvent('crossword_submitted', {
      nodeId: node.id,
      ...response,
      score,
      timeElapsed,
      hintsUsed: gameState.hintsUsed
    });
    
    onContinue(response);
  }, [gameState, node, timeElapsed, updateResponse, trackEvent, onContinue]);

  // Reset game
  const handleReset = useCallback(() => {
    const initialGrid = node.gameSettings.grid.map(row => 
      row.map(cell => ({ ...cell, userInput: '' }))
    );
    
    setGameState({
      grid: initialGrid,
      selectedClue: null,
      selectedCell: null,
      guesses: [],
      completedWords: new Set(),
      isComplete: false,
      timeStarted: new Date(),
      hintsUsed: 0
    });
    
    setTimeElapsed(0);
    
    trackEvent('crossword_reset', { nodeId: node.id });
  }, [node, trackEvent]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress
  const progress = (gameState.completedWords.size / node.gameSettings.clues.length) * 100;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {node.text}
        </Typography>
        {node.content && (
          <Typography variant="body1" sx={{ mb: 2 }}>
            {node.content}
          </Typography>
        )}
        
        {/* Progress and stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
          <Typography variant="body2">
            {gameState.completedWords.size}/{node.gameSettings.clues.length} words
          </Typography>
          <Chip label={formatTime(timeElapsed)} variant="outlined" />
          {gameState.hintsUsed > 0 && (
            <Chip 
              icon={<Lightbulb />} 
              label={`${gameState.hintsUsed} hints`} 
              variant="outlined" 
              size="small"
            />
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Crossword Grid */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Crossword</Typography>
              <Box>
                {node.allowHints && gameState.selectedClue && (
                  <Tooltip title="Get a hint for selected word">
                    <IconButton onClick={handleHint} color="primary">
                      <Lightbulb />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Reset crossword">
                  <IconButton onClick={handleReset}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* Grid Display */}
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(${node.gameSettings.gridSize.width}, 1fr)`,
              gap: 1,
              maxWidth: 400,
              mx: 'auto'
            }}>
              {gameState.grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <Box
                    key={`${rowIndex}-${colIndex}`}
                    sx={{
                      width: 40,
                      height: 40,
                      border: cell.isBlocked ? 'none' : '2px solid #ccc',
                      backgroundColor: cell.isBlocked 
                        ? '#000' 
                        : gameState.selectedCell?.row === rowIndex && gameState.selectedCell?.col === colIndex
                        ? '#e3f2fd'
                        : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      cursor: cell.isBlocked ? 'default' : 'pointer'
                    }}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                  >
                    {/* Cell number */}
                    {cell.number && (
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          top: 1,
                          left: 2,
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {cell.number}
                      </Typography>
                    )}
                    
                    {/* Cell input */}
                    {!cell.isBlocked && (
                      <TextField
                        value={cell.userInput || ''}
                        onChange={(e) => handleCellInput(rowIndex, colIndex, e.target.value)}
                        inputProps={{
                          maxLength: 1,
                          style: {
                            textAlign: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            padding: 0,
                            border: 'none',
                            background: 'transparent'
                          }
                        }}
                        variant="standard"
                        sx={{
                          width: '100%',
                          '& .MuiInput-underline:before': { display: 'none' },
                          '& .MuiInput-underline:after': { display: 'none' }
                        }}
                      />
                    )}
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Clues Panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom>
              Clues
            </Typography>
            
            {/* Across Clues */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
              Across
            </Typography>
            <List dense>
              {acrossClues.map(clue => (
                <ListItem
                  key={`across-${clue.number}`}
                  button
                  selected={gameState.selectedClue?.number === clue.number && gameState.selectedClue?.direction === 'across'}
                  onClick={() => handleClueSelect(clue)}
                  sx={{ pl: 0 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {gameState.completedWords.has(clue.number) ? (
                      <CheckCircle color="success" sx={{ mr: 1, fontSize: 16 }} />
                    ) : (
                      <RadioButtonUnchecked sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                    )}
                    <ListItemText
                      primary={`${clue.number}. ${clue.clue}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
            
            {/* Down Clues */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
              Down
            </Typography>
            <List dense>
              {downClues.map(clue => (
                <ListItem
                  key={`down-${clue.number}`}
                  button
                  selected={gameState.selectedClue?.number === clue.number && gameState.selectedClue?.direction === 'down'}
                  onClick={() => handleClueSelect(clue)}
                  sx={{ pl: 0 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {gameState.completedWords.has(clue.number) ? (
                      <CheckCircle color="success" sx={{ mr: 1, fontSize: 16 }} />
                    ) : (
                      <RadioButtonUnchecked sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                    )}
                    <ListItemText
                      primary={`${clue.number}. ${clue.clue}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Game Complete Message */}
      {gameState.isComplete && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="h6">Congratulations! 🎉</Typography>
          <Typography>
            You completed the crossword in {formatTime(timeElapsed)}
            {gameState.hintsUsed > 0 && ` using ${gameState.hintsUsed} hint${gameState.hintsUsed > 1 ? 's' : ''}`}!
          </Typography>
        </Alert>
      )}

      {/* Continue Button */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleContinue}
          startIcon={<PlayArrow />}
          disabled={!gameState.isComplete && !node.gameSettings.allowPartialSubmit}
        >
          {gameState.isComplete ? 'Continue' : 'Submit Partial'}
        </Button>
      </Box>
    </Box>
  );
};