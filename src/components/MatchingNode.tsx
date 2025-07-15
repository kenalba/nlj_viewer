import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button, Alert, Paper } from '@mui/material';
import { CheckCircle, Close } from '@mui/icons-material';
import type { MatchingNode as MatchingNodeType } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useXAPI } from '../contexts/XAPIContext';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const { playSound } = useAudio();
  const { trackQuestionAnswered } = useXAPI();

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
      
      // If right item is selected, create a match
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
      
      // If left item is selected, create a match
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
    setUserMatches([...filteredMatches, { leftId, rightId }]);
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
      const lineColor = showFeedback ? (isCorrect ? '#4CAF50' : '#f44336') : '#2196F3';

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

      <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
        Click on items from both columns to match them together:
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
          <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
            Column A
          </Typography>
          {question.leftItems.map((item) => {
            const isMatched = isLeftMatched(item.id);
            const isSelected = selectedLeft === item.id;
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
                  border: isSelected ? '2px solid' : '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  backgroundColor: isSelected ? 'action.selected' : 
                                   isMatched ? 'action.hover' : 'background.paper',
                  '&:hover': !showFeedback ? {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  } : {},
                  position: 'relative',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body1">
                    {item.text}
                  </Typography>
                  
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
                  <Typography variant="body2" sx={{ 
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
          <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
            Column B
          </Typography>
          {question.rightItems.map((item) => {
            const isMatched = isRightMatched(item.id);
            const isSelected = selectedRight === item.id;
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
                  border: isSelected ? '2px solid' : '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  backgroundColor: isSelected ? 'action.selected' : 
                                   isMatched ? 'action.hover' : 'background.paper',
                  '&:hover': !showFeedback ? {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  } : {},
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body1">
                    {item.text}
                  </Typography>
                  
                  {isMatched && showFeedback && match && isMatchCorrect(match.leftId, item.id) && (
                    <CheckCircle color="success" fontSize="small" />
                  )}
                </Box>
                
                {isMatched && match && (
                  <Typography variant="body2" sx={{ 
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
              variant="contained"
              onClick={handleContinue}
              sx={{ borderRadius: 3, minWidth: 120 }}
            >
              Continue
            </Button>
          </Box>
        </Box>
      )}
    </NodeCard>
  );
};