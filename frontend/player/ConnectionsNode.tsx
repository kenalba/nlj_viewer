import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  Card, 
  CardContent, 
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
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import type { ConnectionsNode as ConnectionsNodeType, ConnectionsGroup } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from '../shared/MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { MediaDisplay } from '../shared/MediaDisplay';
import { useTheme } from '@mui/material/styles';

interface ConnectionsNodeProps {
  question: ConnectionsNodeType;
  onAnswer: (response: { foundGroups: ConnectionsGroup[]; mistakes: number; completed: boolean }) => void;
}

// Difficulty color mapping - lightened for better black text readability
const difficultyColors = {
  yellow: '#f9e79f',
  green: '#85e085',
  blue: '#7fb3d3',
  purple: '#bb8fce'
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
  const [showContinue, setShowContinue] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | null>(null);
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
        setShowContinue(true);
        // Don't auto-advance, wait for continue button
      }
    } else {
      // Incorrect guess - check if it's "so close" (3 out of 4 correct)
      let closestMatch = null;
      let maxMatches = 0;
      
      for (const group of gameData.groups) {
        if (foundGroups.some(fg => fg.category === group.category)) continue;
        const matches = selectedWords.filter(word => group.words.includes(word)).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          closestMatch = group;
        }
      }
      
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setSelectedWords([]);
      
      if (maxMatches === 3) {
        setFeedback('SO CLOSE! One away from the correct group.');
        setFeedbackType('info');
      } else {
        setFeedback(`Incorrect. ${maxMistakes - newMistakes} mistake${maxMistakes - newMistakes !== 1 ? 's' : ''} remaining.`);
        setFeedbackType('error');
      }
      
      setIsShaking(true);
      playSound('incorrect');
      
      // Check if game is over
      if (newMistakes >= maxMistakes) {
        setGameComplete(true);
        setShowContinue(true);
        // Don't auto-advance, wait for continue button
      }
      
      // Remove shake animation after duration
      setTimeout(() => setIsShaking(false), 500);
    }
    
    // Clear feedback after 2 seconds (unless game is complete)
    setTimeout(() => {
      if (!gameComplete) {
        setFeedback(null);
        setFeedbackType(null);
      }
    }, 2000);
  };
  
  // Track xAPI events
  useEffect(() => {
    if (gameComplete) {
      trackQuestionAnswered(
        question.id,
        'connections',
        `${foundGroups.length} groups found, ${mistakes} mistakes`,
        foundGroups.length === gameData.groups.length,
        Date.now() - questionStartTime.getTime()
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
          color: 'white',
          '& .MuiCardContent-root': { py: 1, px: 2 }
        }}
      >
        <CardContent>
          <Typography 
            variant="body1" 
            fontWeight="bold" 
            textAlign="center"
            sx={{
              color: '#000000',
              fontSize: '1.1rem'
            }}
          >
            {group.category.toUpperCase()}
          </Typography>
          <Typography 
            variant="body2" 
            display="block" 
            textAlign="center" 
            sx={{ 
              color: '#000000',
              fontSize: '0.9rem'
            }}
          >
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
    
    // Dynamic font sizing based on word length - increased for better readability
    const getFontSize = (wordLength: number) => {
      if (isMobile) {
        if (wordLength <= 4) return '1.1rem';
        if (wordLength <= 6) return '0.95rem';
        if (wordLength <= 8) return '0.85rem';
        return '0.75rem';
      } else {
        if (wordLength <= 4) return '1.25rem';
        if (wordLength <= 6) return '1.1rem';
        if (wordLength <= 8) return '0.95rem';
        return '0.85rem';
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
            backgroundColor: isSelected ? theme.palette.text.primary : theme.palette.background.paper,
            color: isSelected ? theme.palette.background.paper : theme.palette.text.primary,
            borderColor: isSelected ? theme.palette.text.primary : theme.palette.divider,
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
            px: 0.25, 
            py: 0.25,
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
                letterSpacing: '0.025em',
                color: isSelected ? theme.palette.background.paper : 'inherit'
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
        {/* Media */}
        {question.media && (
          <Box sx={{ mb: 2 }}>
            <MediaViewer media={question.media} />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <MediaDisplay mediaList={question.additionalMediaList.map(wrapper => wrapper.media)} />
          </Box>
        )}
        
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
        
        {/* Found Groups */}
        {foundGroups.map(group => renderFoundGroupBanner(group))}
        
        {/* Word Grid - Dynamic Layout */}
        <Box sx={{ mb: 2 }}>
          {remainingWords.length > 0 && (
            <>
              {Array.from({ length: Math.ceil(remainingWords.length / 4) }, (_, rowIndex) => (
                <Box key={rowIndex} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  {Array.from({ length: 4 }, (_, colIndex) => {
                    const wordIndex = rowIndex * 4 + colIndex;
                    const word = remainingWords[wordIndex];
                    return word ? renderWordCard(word) : (
                      <Box key={`empty-${colIndex}`} sx={{ display: 'flex', flex: 1 }}>
                        <Box sx={{ height: '60px', width: '100%', visibility: 'hidden' }} />
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </>
          )}
        </Box>
        
        {/* Controls - Fixed spacing */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', minHeight: '36px', alignItems: 'center' }}>
          {!gameComplete || !showContinue ? (
            <>
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
            </>
          ) : (
            <Button 
              variant="contained" 
              size="small"
              onClick={() => {
                onAnswer({
                  foundGroups,
                  mistakes,
                  completed: foundGroups.length === gameData.groups.length
                });
              }}
            >
              Continue
            </Button>
          )}
        </Box>
        
        {/* Feedback - Moved below controls */}
        {feedback && (
          <Slide direction="up" in={feedback !== null}>
            <Alert 
              severity={feedbackType || 'info'} 
              sx={{ mt: 2 }}
              icon={feedbackType === 'success' ? <CheckIcon /> : (feedbackType === 'info' ? <CheckIcon /> : <ErrorIcon />)}
            >
              {feedback}
            </Alert>
          </Slide>
        )}
        
        
        {/* Game Complete Message with missed groups */}
        {gameComplete && (
          <Box sx={{ mt: 2 }}>
            <Alert 
              severity={foundGroups.length === gameData.groups.length ? 'success' : 'warning'}
              sx={{ mb: foundGroups.length === gameData.groups.length || !showContinue ? 0 : 2 }}
            >
              {foundGroups.length === gameData.groups.length 
                ? 'Congratulations! You found all the groups!' 
                : 'Game Over! You ran out of mistakes.'}
            </Alert>
            
            {/* Show missed groups when failed */}
            {foundGroups.length < gameData.groups.length && showContinue && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom textAlign="center">
                  Groups you missed:
                </Typography>
                {gameData.groups
                  .filter(group => !foundGroups.some(fg => fg.category === group.category))
                  .map(group => renderFoundGroupBanner(group))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </NodeCard>
  );
};