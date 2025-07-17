import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  Card, 
  CardContent, 
  Grid, 
  LinearProgress,
  Chip,
  Slide,
  Grow
} from '@mui/material';
import { 
  Shuffle as ShuffleIcon, 
  Clear as ClearIcon, 
  Send as SubmitIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import type { ConnectionsNode as ConnectionsNodeType, ConnectionsGroup } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MediaDisplay } from './MediaDisplay';
import { useTheme } from '@mui/material/styles';

interface ConnectionsNodeProps {
  question: ConnectionsNodeType;
  onAnswer: (response: { foundGroups: ConnectionsGroup[]; mistakes: number; completed: boolean }) => void;
}

// Difficulty color mapping
const difficultyColors = {
  yellow: '#f1c40f',
  green: '#2ecc71',
  blue: '#3498db',
  purple: '#9b59b6'
};

// Helper function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const ConnectionsNode: React.FC<ConnectionsNodeProps> = ({ question, onAnswer }) => {
  const { gameData } = question;
  const { playSound } = useAudio();
  const { trackQuestionAnswered } = useXAPI();
  const isMobile = useIsMobile();
  const theme = useTheme();
  
  // Game state
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [foundGroups, setFoundGroups] = useState<ConnectionsGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null);
  const [questionStartTime] = useState(new Date());
  const [isShaking, setIsShaking] = useState(false);
  
  // Initialize shuffled words
  const [shuffledWords, setShuffledWords] = useState<string[]>(() => {
    const allWords = gameData.groups.flatMap(group => group.words);
    return gameData.shuffleWords !== false ? shuffleArray(allWords) : allWords;
  });
  
  // Calculate remaining words (words not in found groups)
  const remainingWords = useMemo(() => {
    const foundWords = new Set(foundGroups.flatMap(group => group.words));
    return shuffledWords.filter(word => !foundWords.has(word));
  }, [shuffledWords, foundGroups]);
  
  // Max mistakes (default 4)
  const maxMistakes = gameData.maxMistakes || 4;
  
  // Handle word selection
  const handleWordClick = (word: string) => {
    if (gameComplete || foundGroups.some(group => group.words.includes(word))) {
      return;
    }
    
    setSelectedWords(prev => {
      if (prev.includes(word)) {
        return prev.filter(w => w !== word);
      } else if (prev.length < 4) {
        return [...prev, word];
      }
      return prev;
    });
  };
  
  // Handle shuffle
  const handleShuffle = () => {
    setShuffledWords(shuffleArray(remainingWords));
    setSelectedWords([]);
    playSound('click');
  };
  
  // Handle deselect all
  const handleDeselectAll = () => {
    setSelectedWords([]);
    playSound('click');
  };
  
  // Handle guess submission
  const handleSubmitGuess = () => {
    if (selectedWords.length !== 4) return;
    
    // Check if the selected words form a valid group
    const matchingGroup = gameData.groups.find(group => 
      group.words.every(word => selectedWords.includes(word)) &&
      selectedWords.every(word => group.words.includes(word))
    );
    
    if (matchingGroup && !foundGroups.some(fg => fg.category === matchingGroup.category)) {
      // Correct guess
      setFoundGroups(prev => [...prev, matchingGroup]);
      setSelectedWords([]);
      setFeedback(`Correct! ${matchingGroup.category}`);
      setFeedbackType('success');
      playSound('correct');
      
      // Check if game is complete
      if (foundGroups.length + 1 === gameData.groups.length) {
        setGameComplete(true);
        setTimeout(() => {
          onAnswer({
            foundGroups: [...foundGroups, matchingGroup],
            mistakes,
            completed: true
          });
        }, 1500);
      }
    } else {
      // Incorrect guess
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setSelectedWords([]);
      setFeedback(`Incorrect. ${maxMistakes - newMistakes} mistake${maxMistakes - newMistakes !== 1 ? 's' : ''} remaining.`);
      setFeedbackType('error');
      setIsShaking(true);
      playSound('incorrect');
      
      // Check if game is over
      if (newMistakes >= maxMistakes) {
        setGameComplete(true);
        setTimeout(() => {
          onAnswer({
            foundGroups,
            mistakes: newMistakes,
            completed: false
          });
        }, 1500);
      }
      
      // Remove shake animation after duration
      setTimeout(() => setIsShaking(false), 500);
    }
    
    // Clear feedback after 2 seconds
    setTimeout(() => {
      setFeedback(null);
      setFeedbackType(null);
    }, 2000);
  };
  
  // Track xAPI events
  useEffect(() => {
    if (gameComplete) {
      trackQuestionAnswered(
        question.id,
        { foundGroups, mistakes, completed: foundGroups.length === gameData.groups.length },
        foundGroups.length === gameData.groups.length,
        questionStartTime
      );
    }
  }, [gameComplete, foundGroups, mistakes, question.id, trackQuestionAnswered, questionStartTime, gameData.groups.length]);
  
  // Render found group banner
  const renderFoundGroupBanner = (group: ConnectionsGroup) => (
    <Grow in={true} key={group.category}>
      <Card 
        sx={{ 
          mb: 1, 
          backgroundColor: difficultyColors[group.difficulty],
          color: group.difficulty === 'yellow' ? '#333' : 'white',
          '& .MuiCardContent-root': { py: 1, px: 2 }
        }}
      >
        <CardContent>
          <Typography variant="body2" fontWeight="bold" textAlign="center">
            {group.category.toUpperCase()}
          </Typography>
          <Typography variant="caption" display="block" textAlign="center" sx={{ opacity: 0.9 }}>
            {group.words.join(', ')}
          </Typography>
        </CardContent>
      </Card>
    </Grow>
  );
  
  // Render word card
  const renderWordCard = (word: string) => {
    const isSelected = selectedWords.includes(word);
    const isFound = foundGroups.some(group => group.words.includes(word));
    
    if (isFound) return null;
    
    // Dynamic font sizing based on word length
    const getFontSize = (wordLength: number) => {
      if (isMobile) {
        if (wordLength <= 4) return '0.875rem';
        if (wordLength <= 6) return '0.75rem';
        if (wordLength <= 8) return '0.65rem';
        return '0.6rem';
      } else {
        if (wordLength <= 4) return '1rem';
        if (wordLength <= 6) return '0.875rem';
        if (wordLength <= 8) return '0.75rem';
        return '0.65rem';
      }
    };
    
    return (
      <Box key={word} sx={{ display: 'flex', flex: 1 }}>
        <Card
          onClick={() => handleWordClick(word)}
          sx={{
            cursor: gameComplete ? 'default' : 'pointer',
            height: '60px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isSelected ? theme.palette.primary.main : theme.palette.background.paper,
            color: isSelected ? theme.palette.primary.contrastText : theme.palette.text.primary,
            borderColor: isSelected ? theme.palette.primary.main : theme.palette.divider,
            border: '2px solid',
            transition: 'all 0.2s ease',
            transform: isShaking && isSelected ? 'translateX(-2px)' : 'none',
            animation: isShaking && isSelected ? 'shake 0.5s ease-in-out' : 'none',
            '&:hover': gameComplete ? {} : {
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[4],
            },
            '@keyframes shake': {
              '0%, 100%': { transform: 'translateX(0)' },
              '25%': { transform: 'translateX(-4px)' },
              '75%': { transform: 'translateX(4px)' }
            }
          }}
        >
          <Box sx={{ 
            textAlign: 'center', 
            px: 0.5, 
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}>
            <Typography 
              variant="body2" 
              fontWeight="bold" 
              sx={{ 
                fontSize: getFontSize(word.length),
                wordBreak: 'break-word',
                lineHeight: 1.1,
                textTransform: 'uppercase',
                letterSpacing: '0.025em'
              }}
            >
              {word}
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  };
  
  return (
    <NodeCard>
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header */}
        <Typography variant="h5" gutterBottom textAlign="center" fontWeight="bold">
          {gameData.title}
        </Typography>
        
        {/* Instructions */}
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>
          {gameData.instructions}
        </Typography>
        
        {/* Question content */}
        {question.content && (
          <Box sx={{ mb: 2 }}>
            <MarkdownRenderer content={question.content} />
          </Box>
        )}
        
        {/* Media */}
        {question.media && (
          <Box sx={{ mb: 2 }}>
            <MediaViewer media={question.media} />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <MediaDisplay mediaList={question.additionalMediaList} />
          </Box>
        )}
        
        {/* Game Stats */}
        {gameData.showProgress !== false && (
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Mistakes: <span style={{ color: theme.palette.error.main }}>{mistakes}</span>/{maxMistakes}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Groups found: {foundGroups.length}/{gameData.groups.length}
            </Typography>
          </Box>
        )}
        
        {/* Progress Bar */}
        {gameData.showProgress !== false && (
          <LinearProgress 
            variant="determinate" 
            value={(foundGroups.length / gameData.groups.length) * 100} 
            sx={{ mb: 2, height: 8, borderRadius: 4 }}
          />
        )}
        
        {/* Feedback */}
        {feedback && (
          <Slide direction="down" in={feedback !== null}>
            <Alert 
              severity={feedbackType || 'info'} 
              sx={{ mb: 2 }}
              icon={feedbackType === 'success' ? <CheckIcon /> : <ErrorIcon />}
            >
              {feedback}
            </Alert>
          </Slide>
        )}
        
        {/* Found Groups */}
        {foundGroups.map(group => renderFoundGroupBanner(group))}
        
        {/* Word Grid - 4x4 Layout */}
        <Box sx={{ mb: 2 }}>
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <Box key={rowIndex} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              {Array.from({ length: 4 }, (_, colIndex) => {
                const wordIndex = rowIndex * 4 + colIndex;
                const word = remainingWords[wordIndex];
                return word ? renderWordCard(word) : (
                  <Box key={`empty-${colIndex}`} sx={{ display: 'flex', flex: 1 }}>
                    <Box sx={{ height: '60px', width: '100%' }} />
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
        
        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<ShuffleIcon />}
            onClick={handleShuffle}
            disabled={gameComplete || remainingWords.length === 0}
          >
            Shuffle
          </Button>
          
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleDeselectAll}
            disabled={gameComplete || selectedWords.length === 0}
          >
            Deselect All
          </Button>
          
          <Button 
            variant="contained" 
            size="small"
            startIcon={<SubmitIcon />}
            onClick={handleSubmitGuess}
            disabled={gameComplete || selectedWords.length !== 4}
          >
            Submit
          </Button>
        </Box>
        
        {/* Selection indicator */}
        {selectedWords.length > 0 && !gameComplete && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Selected: {selectedWords.length}/4
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              {selectedWords.map(word => (
                <Chip 
                  key={word} 
                  label={word} 
                  size="small" 
                  color="primary"
                  onDelete={() => handleWordClick(word)}
                />
              ))}
            </Box>
          </Box>
        )}
        
        {/* Game Complete Message */}
        {gameComplete && (
          <Alert 
            severity={foundGroups.length === gameData.groups.length ? 'success' : 'warning'}
            sx={{ mt: 2 }}
          >
            {foundGroups.length === gameData.groups.length 
              ? 'Congratulations! You found all the groups!' 
              : 'Game Over! You ran out of mistakes.'}
          </Alert>
        )}
      </Box>
    </NodeCard>
  );
};