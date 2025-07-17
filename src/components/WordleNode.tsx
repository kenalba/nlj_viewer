import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  CardContent, 
  LinearProgress,
  Chip,
  TextField,
  Paper,
  useMediaQuery
} from '@mui/material';
import { 
  Send as SubmitIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Lightbulb as HintIcon
} from '@mui/icons-material';
import type { WordleNode as WordleNodeType, WordleGuess } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useGameContext } from '../contexts/GameContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MediaDisplay } from './MediaDisplay';
import { useTheme } from '@mui/material/styles';
import { isValidWord as validateWord } from '../utils/wordValidation';

interface WordleNodeProps {
  question: WordleNodeType;
  onAnswer: (response: { guesses: WordleGuess[]; attempts: number; completed: boolean; won: boolean }) => void;
}

// Letter state colors
const letterColors = {
  correct: '#6aaa64',
  present: '#c9b458',
  absent: '#787c7e',
  default: '#d3d6da'
};


// Helper function to get feedback for a guess
const getFeedback = (guess: string, target: string): Array<'correct' | 'present' | 'absent'> => {
  const feedback: Array<'correct' | 'present' | 'absent'> = [];
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  
  // First pass: mark correct positions
  for (let i = 0; i < guessLetters.length; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      feedback[i] = 'correct';
      targetLetters[i] = ''; // Mark as used
    }
  }
  
  // Second pass: mark present/absent
  for (let i = 0; i < guessLetters.length; i++) {
    if (feedback[i] === 'correct') continue;
    
    const letterIndex = targetLetters.indexOf(guessLetters[i]);
    if (letterIndex !== -1) {
      feedback[i] = 'present';
      targetLetters[letterIndex] = ''; // Mark as used
    } else {
      feedback[i] = 'absent';
    }
  }
  
  return feedback;
};

// Helper function to check if a word is valid (basic check)
const isValidWord = (word: string, wordLength: number, validWords?: string[], targetWord?: string): boolean => {
  // Always include the target word in the custom words list to ensure it's valid
  const customWords = validWords ? [...validWords] : [];
  if (targetWord && !customWords.includes(targetWord.toUpperCase())) {
    customWords.push(targetWord.toUpperCase());
  }
  
  // If custom words array is provided, use it as additional custom words (not strict mode)
  if (customWords.length > 0) {
    return validateWord(word, wordLength, { customWords, strictMode: false });
  }
  
  // Otherwise, use the built-in word validation
  return validateWord(word, wordLength);
};

export const WordleNode: React.FC<WordleNodeProps> = ({ question, onAnswer }) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { playSound } = useAudio();
  const { reset } = useGameContext();
  const { 
    trackActivityLaunched, 
    trackQuestionAnswered, 
    trackActivityCompleted
  } = useXAPI();
  
  const [guesses, setGuesses] = useState<WordleGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameComplete, setGameComplete] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { gameData, hardMode = false, allowHints = false } = question;
  const { targetWord, wordLength, maxAttempts, validWords, hints } = gameData;
  
  // Track game start
  useEffect(() => {
    // Create a basic scenario object for xAPI tracking
    const gameScenario = {
      id: question.id,
      name: question.text,
      nodes: [],
      links: [],
      orientation: 'vertical' as const,
      activityType: 'game' as const
    };
    trackActivityLaunched(gameScenario);
  }, [question.id, question.text, trackActivityLaunched]);
  
  
  
  
  const handleSubmitGuess = () => {
    if (currentGuess.length !== wordLength) {
      setError(`Word must be ${wordLength} letters long`);
      return;
    }
    
    if (!isValidWord(currentGuess, wordLength, validWords, targetWord)) {
      setError('Not a valid word');
      return;
    }
    
    // Hard mode validation
    if (hardMode && guesses.length > 0) {
      const previousGuess = guesses[guesses.length - 1];
      for (let i = 0; i < currentGuess.length; i++) {
        if (previousGuess.feedback[i] === 'correct' && currentGuess[i] !== previousGuess.word[i]) {
          setError('Hard mode: must use revealed letters');
          return;
        }
        if (previousGuess.feedback[i] === 'present' && !currentGuess.includes(previousGuess.word[i])) {
          setError('Hard mode: must use revealed letters');
          return;
        }
      }
    }
    
    const feedback = getFeedback(currentGuess, targetWord.toUpperCase());
    const newGuess: WordleGuess = {
      word: currentGuess,
      feedback,
      timestamp: new Date().toISOString()
    };
    
    const newGuesses = [...guesses, newGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');
    setError(null);
    
    // Track guess submission
    trackQuestionAnswered(
      question.id,
      'wordle',
      currentGuess,
      feedback.every(f => f === 'correct'),
      0, // timeSpent - we could track this if needed
      newGuesses.length
    );
    
    // Check if game is won
    if (currentGuess.toLowerCase() === targetWord.toLowerCase()) {
      setGameWon(true);
      setGameComplete(true);
      playSound('correct');
      const gameScenario = {
        id: question.id,
        name: question.text,
        nodes: [],
        links: [],
        orientation: 'vertical' as const,
        activityType: 'game' as const
      };
      trackActivityCompleted(gameScenario, calculateScore(newGuesses.length, maxAttempts));
    } else if (newGuesses.length >= maxAttempts) {
      setGameComplete(true);
      playSound('incorrect');
      const gameScenario = {
        id: question.id,
        name: question.text,
        nodes: [],
        links: [],
        orientation: 'vertical' as const,
        activityType: 'game' as const
      };
      trackActivityCompleted(gameScenario, 0);
    }
  };
  
  const calculateScore = (attempts: number, maxAttempts: number): number => {
    const { basePoints = 50, bonusPerRemainingAttempt = 10 } = question.scoring || {};
    const remainingAttempts = maxAttempts - attempts;
    return basePoints + (remainingAttempts * bonusPerRemainingAttempt);
  };

  const handleContinue = () => {
    // Call parent callback to proceed to next node
    onAnswer({
      guesses,
      attempts: guesses.length,
      completed: true,
      won: gameWon
    });
  };
  
  const handleShowHint = () => {
    if (allowHints && hints && hints.length > 0) {
      setShowHint(true);
    }
  };
  
  const renderGuessGrid = () => {
    const rows = [];
    
    // Render completed guesses
    for (let i = 0; i < guesses.length; i++) {
      const guess = guesses[i];
      const row = [];
      
      for (let j = 0; j < wordLength; j++) {
        const letter = guess.word[j] || '';
        const feedback = guess.feedback[j] || 'absent';
        
        row.push(
          <Paper
            key={`${i}-${j}`}
            elevation={1}
            sx={{
              width: isSmallScreen ? 32 : 40,
              height: isSmallScreen ? 32 : 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: letterColors[feedback as keyof typeof letterColors] || letterColors.default,
              color: feedback === 'absent' ? 'text.primary' : 'white',
              border: feedback === 'absent' ? '1px solid #d3d6da' : 'none',
              fontSize: isSmallScreen ? '14px' : '16px',
              fontWeight: 'bold'
            }}
          >
            {letter}
          </Paper>
        );
      }
      
      rows.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {row}
        </Box>
      );
    }
    
    // Render current guess row
    if (!gameComplete) {
      const row = [];
      for (let j = 0; j < wordLength; j++) {
        const letter = currentGuess[j] || '';
        
        row.push(
          <Paper
            key={`current-${j}`}
            elevation={1}
            sx={{
              width: isSmallScreen ? 32 : 40,
              height: isSmallScreen ? 32 : 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'background.paper',
              color: 'text.primary',
              border: '2px solid #d3d6da',
              fontSize: isSmallScreen ? '14px' : '16px',
              fontWeight: 'bold'
            }}
          >
            {letter}
          </Paper>
        );
      }
      
      rows.push(
        <Box key="current" sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {row}
        </Box>
      );
    }
    
    // Render empty rows
    const emptyRows = maxAttempts - guesses.length - (gameComplete ? 0 : 1);
    for (let i = 0; i < emptyRows; i++) {
      const row = [];
      for (let j = 0; j < wordLength; j++) {
        row.push(
          <Paper
            key={`empty-${i}-${j}`}
            elevation={1}
            sx={{
              width: isSmallScreen ? 32 : 40,
              height: isSmallScreen ? 32 : 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'background.paper',
              border: '1px solid #d3d6da',
              fontSize: isSmallScreen ? '14px' : '16px',
              fontWeight: 'bold'
            }}
          >
          </Paper>
        );
      }
      
      rows.push(
        <Box key={`empty-${i}`} sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {row}
        </Box>
      );
    }
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
        {rows}
      </Box>
    );
  };
  
  
  return (
    <NodeCard>
      <CardContent>
        {question.media && (
          <Box sx={{ my: 2 }}>
            <MediaDisplay mediaList={[question.media]} />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ my: 2 }}>
            {question.additionalMediaList.map((wrapper, index) => (
              <MediaViewer key={index} media={wrapper.media} />
            ))}
          </Box>
        )}
        
        <Typography variant="h6" gutterBottom>
          {question.text}
        </Typography>
        
        {question.content && (
          <MarkdownRenderer content={question.content} />
        )}
        
        {/* Game Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="body2">
            Attempt {guesses.length + (gameComplete ? 0 : 1)} of {maxAttempts}
          </Typography>
          
          {hardMode && (
            <Chip label="Hard Mode" color="primary" size="small" />
          )}
          
          {allowHints && hints && hints.length > 0 && (
            <Button
              size="small"
              startIcon={<HintIcon />}
              onClick={handleShowHint}
              disabled={showHint}
            >
              Hint
            </Button>
          )}
        </Box>
        
        {/* Progress Bar */}
        <LinearProgress
          variant="determinate"
          value={(guesses.length / maxAttempts) * 100}
          sx={{ mb: 2 }}
        />
        
        {/* Hint Display */}
        {showHint && hints && hints.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Hint:</strong> {hints[0]}
          </Alert>
        )}
        
        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* Game Complete Messages */}
        {gameComplete && (
          <Alert 
            severity={gameWon ? "success" : "error"} 
            sx={{ mb: 2 }}
            icon={gameWon ? <CheckIcon /> : <ErrorIcon />}
          >
            {gameWon ? (
              <>
                <strong>Congratulations!</strong> You solved it in {guesses.length} attempt{guesses.length === 1 ? '' : 's'}!
                {question.scoring && (
                  <><br />Score: {calculateScore(guesses.length, maxAttempts)} points</>
                )}
              </>
            ) : (
              <>
                <strong>Game Over!</strong> The word was: <strong>{targetWord.toUpperCase()}</strong>
                <br />You used all {maxAttempts} attempts.
              </>
            )}
          </Alert>
        )}
        
        {/* Guess Grid */}
        {renderGuessGrid()}
        
        {/* Text Input */}
        {!gameComplete && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <TextField
              ref={inputRef}
              value={currentGuess}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                if (value.length <= wordLength && /^[A-Z]*$/.test(value)) {
                  setCurrentGuess(value);
                  setError(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && currentGuess.length === wordLength) {
                  handleSubmitGuess();
                }
              }}
              placeholder={`Enter ${wordLength}-letter word`}
              variant="outlined"
              inputProps={{
                maxLength: wordLength,
                style: { 
                  textAlign: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }
              }}
              sx={{
                width: `${wordLength * 3}ch`,
                maxWidth: '90%',
                '& .MuiOutlinedInput-input': {
                  textAlign: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em'
                }
              }}
              autoFocus
              autoComplete="off"
            />
          </Box>
        )}
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'center' }}>
          {!gameComplete && (
            <Button
              variant="contained"
              onClick={handleSubmitGuess}
              disabled={currentGuess.length !== wordLength}
              startIcon={<SubmitIcon />}
            >
              Submit
            </Button>
          )}
          
          {gameComplete && (
            <>
              <Button
                variant="contained"
                onClick={handleContinue}
                sx={{ mr: 1 }}
              >
                Continue
              </Button>
              <Button
                variant="outlined"
                onClick={() => reset()}
                startIcon={<RefreshIcon />}
              >
                Return to Menu
              </Button>
            </>
          )}
        </Box>
      </CardContent>
    </NodeCard>
  );
};