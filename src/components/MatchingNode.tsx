import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button, Alert, Paper, useTheme, FormHelperText } from '@mui/material';
import { CheckCircle, Close } from '@mui/icons-material';
import type { MatchingNode as MatchingNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MatchingNodeProps {
  question: MatchingNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

interface UserMatch {
  leftId: string;
  rightId: string;
}

export const MatchingNode: React.FC<MatchingNodeProps> = ({ question, onAnswer }) => {
  const [userMatches, setUserMatches] = useState<UserMatch[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [questionStartTime] = useState(new Date());
  
  // Keyboard navigation state
  const [focusedColumn, setFocusedColumn] = useState<'left' | 'right' | null>('left');
  const [focusedLeftIndex, setFocusedLeftIndex] = useState(0);
  const [focusedRightIndex, setFocusedRightIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { playSound } = useAudio();
  const { trackQuestionAnswered } = useXAPI();
  const theme = useTheme();
  const isMobile = useIsMobile();

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        // Force re-render of connection lines when matches change
        containerRef.current.style.transform = 'translateZ(0)';
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [userMatches]);


  const handleLeftClick = (leftId: string) => {
    if (showFeedback) return;
    
    playSound('click');
    
    if (selectedLeft === leftId) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(leftId);
      
      // If right item is selected, create a match immediately
      if (selectedRight) {
        createMatch(leftId, selectedRight);
      }
    }
  };

  const handleRightClick = (rightId: string) => {
    if (showFeedback) return;
    
    playSound('click');
    
    if (selectedRight === rightId) {
      setSelectedRight(null);
    } else {
      setSelectedRight(rightId);
      
      // If left item is selected, create a match immediately
      if (selectedLeft) {
        createMatch(selectedLeft, rightId);
      }
    }
  };

  const createMatch = (leftId: string, rightId: string) => {
    // Remove any existing matches for these items
    const filteredMatches = userMatches.filter(
      match => match.leftId !== leftId && match.rightId !== rightId
    );
    
    // Add new match
    const newMatch = { leftId, rightId };
    const newMatches = [...filteredMatches, newMatch];
    setUserMatches(newMatches);
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const removeMatch = (leftId: string, rightId: string) => {
    if (showFeedback) return;
    
    playSound('click');
    setUserMatches(userMatches.filter(
      match => !(match.leftId === leftId && match.rightId === rightId)
    ));
  };

  const isLeftMatched = (leftId: string) => {
    return userMatches.some(match => match.leftId === leftId);
  };

  const isRightMatched = (rightId: string) => {
    return userMatches.some(match => match.rightId === rightId);
  };

  const getMatchForLeft = (leftId: string) => {
    return userMatches.find(match => match.leftId === leftId);
  };

  const getMatchForRight = (rightId: string) => {
    return userMatches.find(match => match.rightId === rightId);
  };

  const getRightItemText = (rightId: string) => {
    const item = question.rightItems.find(item => item.id === rightId);
    return item?.text || '';
  };

  const getLeftItemText = (leftId: string) => {
    const item = question.leftItems.find(item => item.id === leftId);
    return item?.text || '';
  };

  const handleSubmit = () => {
    setShowFeedback(true);
    
    // Check if all matches are correct
    const isCorrect = userMatches.length === question.correctMatches.length &&
      userMatches.every(userMatch => 
        question.correctMatches.some(correctMatch => 
          correctMatch.leftId === userMatch.leftId && 
          correctMatch.rightId === userMatch.rightId
        )
      );
    
    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }
    
    // Track question interaction
    const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000);
    trackQuestionAnswered(
      question.id,
      'matching',
      JSON.stringify(userMatches),
      isCorrect,
      timeSpent,
      1 // First attempt
    );
  };

  const handleContinue = () => {
    const isCorrect = userMatches.length === question.correctMatches.length &&
      userMatches.every(userMatch => 
        question.correctMatches.some(correctMatch => 
          correctMatch.leftId === userMatch.leftId && 
          correctMatch.rightId === userMatch.rightId
        )
      );
    onAnswer(isCorrect);
  };

  const isMatchCorrect = (leftId: string, rightId: string) => {
    return question.correctMatches.some(match => 
      match.leftId === leftId && match.rightId === rightId
    );
  };

  const getFeedbackMessage = () => {
    const isCorrect = userMatches.length === question.correctMatches.length &&
      userMatches.every(userMatch => 
        question.correctMatches.some(correctMatch => 
          correctMatch.leftId === userMatch.leftId && 
          correctMatch.rightId === userMatch.rightId
        )
      );
    
    if (isCorrect) {
      return 'Correct! You have matched all items correctly.';
    } else {
      const correctMatchDescriptions = question.correctMatches.map(match => {
        const leftText = getLeftItemText(match.leftId);
        const rightText = getRightItemText(match.rightId);
        return `"${leftText}" ↔ "${rightText}"`;
      });
      return `Incorrect. The correct matches are: ${correctMatchDescriptions.join(', ')}`;
    }
  };

  const getFeedbackSeverity = () => {
    const isCorrect = userMatches.length === question.correctMatches.length &&
      userMatches.every(userMatch => 
        question.correctMatches.some(correctMatch => 
          correctMatch.leftId === userMatch.leftId && 
          correctMatch.rightId === userMatch.rightId
        )
      );
    return isCorrect ? 'success' : 'error';
  };

  const renderConnectionLines = () => {
    if (!containerRef.current || userMatches.length === 0) return null;

    const lines = userMatches.map((match) => {
      const leftElement = containerRef.current?.querySelector(`[data-left-id="${match.leftId}"]`);
      const rightElement = containerRef.current?.querySelector(`[data-right-id="${match.rightId}"]`);
      
      if (!leftElement || !rightElement) return null;

      const leftRect = leftElement.getBoundingClientRect();
      const rightRect = rightElement.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();

      const startX = leftRect.right - containerRect.left;
      const startY = leftRect.top + leftRect.height / 2 - containerRect.top;
      const endX = rightRect.left - containerRect.left;
      const endY = rightRect.top + rightRect.height / 2 - containerRect.top;

      const isCorrect = showFeedback && isMatchCorrect(match.leftId, match.rightId);
      const lineColor = showFeedback 
        ? (isCorrect ? theme.palette.success.main : theme.palette.error.main) 
        : theme.palette.info.main;

      return (
        <line
          key={`${match.leftId}-${match.rightId}`}
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={lineColor}
          strokeWidth="3"
          strokeDasharray={showFeedback && !isCorrect ? "5,5" : "none"}
        />
      );
    });

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        {lines}
      </svg>
    );
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showFeedback) {
        // Only handle Enter for continue when showing feedback
        if (event.key === 'Enter') {
          event.preventDefault();
          handleContinue();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          if (focusedColumn === 'left') {
            setFocusedLeftIndex(Math.max(0, focusedLeftIndex - 1));
          } else if (focusedColumn === 'right') {
            setFocusedRightIndex(Math.max(0, focusedRightIndex - 1));
          }
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (focusedColumn === 'left') {
            setFocusedLeftIndex(Math.min(question.leftItems.length - 1, focusedLeftIndex + 1));
          } else if (focusedColumn === 'right') {
            setFocusedRightIndex(Math.min(question.rightItems.length - 1, focusedRightIndex + 1));
          }
          break;

        case 'ArrowLeft':
          event.preventDefault();
          setFocusedColumn('left');
          break;

        case 'ArrowRight':
        case 'Tab':
          event.preventDefault();
          setFocusedColumn('right');
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedColumn === 'left') {
            handleLeftClick(question.leftItems[focusedLeftIndex].id);
          } else if (focusedColumn === 'right') {
            handleRightClick(question.rightItems[focusedRightIndex].id);
          }
          break;

        case 'Escape':
          event.preventDefault();
          setSelectedLeft(null);
          setSelectedRight(null);
          break;

        case 'Backspace':
        case 'Delete':
          event.preventDefault();
          if (focusedColumn === 'left' && selectedLeft === null) {
            const leftId = question.leftItems[focusedLeftIndex].id;
            const match = getMatchForLeft(leftId);
            if (match) {
              removeMatch(leftId, match.rightId);
            }
          } else if (focusedColumn === 'right' && selectedRight === null) {
            const rightId = question.rightItems[focusedRightIndex].id;
            const match = getMatchForRight(rightId);
            if (match) {
              removeMatch(match.leftId, rightId);
            }
          }
          break;

        case 's':
        case 'S':
          if (event.ctrlKey || event.metaKey) return; // Don't interfere with Ctrl+S
          event.preventDefault();
          if (userMatches.length > 0) {
            handleSubmit();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showFeedback, focusedColumn, focusedLeftIndex, focusedRightIndex, question.leftItems, question.rightItems, userMatches, selectedLeft, selectedRight, question.correctMatches, onAnswer, getMatchForLeft, getMatchForRight, handleLeftClick, handleRightClick, handleSubmit, removeMatch, handleContinue]);

  return (
    <NodeCard animate={true}>
      <Box sx={{ mb: 3 }}>
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
      </Box>

      <Typography sx={{ mb: 2, color: 'text.secondary' }}>
        Click on items from both columns to match them together, or use keyboard navigation:
      </Typography>

      <Box 
        ref={containerRef}
        sx={{ 
          display: 'flex', 
          gap: 3, 
          mb: 3, 
          position: 'relative',
          minHeight: '300px'
        }}
      >
        {renderConnectionLines()}
        
        {/* Left Column */}
        <Box sx={{ flex: 1, position: 'relative', zIndex: 2 }}>
          <Typography sx={{ mb: 2, textAlign: 'center' }}>
            Column A
          </Typography>
          {question.leftItems.map((item, index) => {
            const isMatched = isLeftMatched(item.id);
            const isSelected = selectedLeft === item.id;
            const isFocused = !showFeedback && focusedColumn === 'left' && focusedLeftIndex === index;
            const match = getMatchForLeft(item.id);
            
            return (
              <Paper
                key={item.id}
                data-left-id={item.id}
                onClick={() => handleLeftClick(item.id)}
                sx={{
                  p: 2,
                  mb: 1,
                  cursor: showFeedback ? 'default' : 'pointer',
                  border: isSelected ? '2px solid' : (isFocused ? '2px solid' : '1px solid'),
                  borderColor: isSelected ? 'primary.main' : 
                              isFocused ? 'secondary.main' : 'divider',
                  backgroundColor: isSelected ? 'action.selected' : 
                                   isFocused ? 'action.focus' :
                                   isMatched ? 'action.hover' : 'background.paper',
                  '&:hover': !showFeedback ? {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  } : {},
                  position: 'relative',
                  outline: isFocused ? '2px solid' : 'none',
                  outlineColor: isFocused ? 'secondary.light' : 'transparent',
                  outlineOffset: isFocused ? '1px' : '0px',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <MarkdownRenderer
                    content={item.text}
                    
                  />
                  
                  {isMatched && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {showFeedback && match && isMatchCorrect(item.id, match.rightId) && (
                        <CheckCircle color="success" fontSize="small" />
                      )}
                      {!showFeedback && match && (
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMatch(item.id, match.rightId);
                          }}
                          sx={{ minWidth: 'auto', p: 0.5 }}
                        >
                          <Close fontSize="small" />
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
                
                {isMatched && match && (
                  <Typography sx={{ 
                    mt: 1, 
                    color: 'text.secondary', 
                    fontStyle: 'italic' 
                  }}>
                    → {getRightItemText(match.rightId)}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>

        {/* Right Column */}
        <Box sx={{ flex: 1, position: 'relative', zIndex: 2 }}>
          <Typography sx={{ mb: 2, textAlign: 'center' }}>
            Column B
          </Typography>
          {question.rightItems.map((item, index) => {
            const isMatched = isRightMatched(item.id);
            const isSelected = selectedRight === item.id;
            const isFocused = !showFeedback && focusedColumn === 'right' && focusedRightIndex === index;
            const match = getMatchForRight(item.id);
            
            return (
              <Paper
                key={item.id}
                data-right-id={item.id}
                onClick={() => handleRightClick(item.id)}
                sx={{
                  p: 2,
                  mb: 1,
                  cursor: showFeedback ? 'default' : 'pointer',
                  border: isSelected ? '2px solid' : (isFocused ? '2px solid' : '1px solid'),
                  borderColor: isSelected ? 'primary.main' : 
                              isFocused ? 'secondary.main' : 'divider',
                  backgroundColor: isSelected ? 'action.selected' : 
                                   isFocused ? 'action.focus' :
                                   isMatched ? 'action.hover' : 'background.paper',
                  '&:hover': !showFeedback ? {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  } : {},
                  outline: isFocused ? '2px solid' : 'none',
                  outlineColor: isFocused ? 'secondary.light' : 'transparent',
                  outlineOffset: isFocused ? '1px' : '0px',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <MarkdownRenderer
                    content={item.text}
                    
                  />
                  
                  {isMatched && showFeedback && match && isMatchCorrect(match.leftId, item.id) && (
                    <CheckCircle color="success" fontSize="small" />
                  )}
                </Box>
                
                {isMatched && match && (
                  <Typography sx={{ 
                    mt: 1, 
                    color: 'text.secondary', 
                    fontStyle: 'italic' 
                  }}>
                    ← {getLeftItemText(match.leftId)}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>

      {/* Submit Button */}
      {!showFeedback && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={userMatches.length === 0}
            sx={{ borderRadius: 3, minWidth: 120 }}
          >
            Submit Matches
          </Button>
        </Box>
      )}

      {showFeedback && (
        <Box>
          <Alert 
            severity={getFeedbackSeverity() as 'success' | 'error'} 
            sx={{ 
              mt: 2,
              mb: 2,
              borderRadius: 2,
              '& .MuiAlert-message': {
                width: '100%',
                textAlign: 'center'
              }
            }}
          >
            {getFeedbackMessage()}
          </Alert>
          
          {/* Continue Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              
              onClick={handleContinue}
              sx={{ borderRadius: 3, minWidth: 120 }}
            >
              Continue
            </Button>
          </Box>
        </Box>
      )}
      
      {/* Keyboard Controls Helper - Hide on mobile */}
      {!isMobile && (
        <FormHelperText sx={{ textAlign: 'center', mt: 2, fontSize: '0.75rem', opacity: 0.7 }}>
          {showFeedback ? 
            'Press Enter to continue' : 
            'Use arrow keys to navigate • Enter/Space to select • Tab to switch columns • Escape to clear • Delete to remove matches • S to submit'
          }
        </FormHelperText>
      )}
    </NodeCard>
  );
};