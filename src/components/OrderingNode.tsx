import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Alert, Paper, IconButton, FormHelperText } from '@mui/material';
import { DragIndicator, CheckCircle } from '@mui/icons-material';
import type { OrderingNode as OrderingNodeType, OrderingItem } from '../types/nlj';
import { NodeCard } from './NodeCard';
import { MediaViewer } from './MediaViewer';
import { useAudio } from '../contexts/AudioContext';
import { useNodeSettings } from '../hooks/useNodeSettings';
import { useIsMobile } from '../utils/mobileDetection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MediaDisplay } from './MediaDisplay';

interface OrderingNodeProps {
  question: OrderingNodeType;
  onAnswer: (isCorrect: boolean) => void;
}

export const OrderingNode: React.FC<OrderingNodeProps> = ({ question, onAnswer }) => {
  const settings = useNodeSettings(question.id);
  const [orderedItems, setOrderedItems] = useState<OrderingItem[]>(() => {
    // Use settings to determine if items should be shuffled
    const shouldShuffle = settings.shuffleAnswerOrder;
    if (import.meta.env.DEV) {
      console.log(`OrderingNode ${question.id}: shuffleAnswerOrder=${shouldShuffle}, reinforcementEligible=${settings.reinforcementEligible}`);
    }
    return shouldShuffle 
      ? [...question.items].sort(() => Math.random() - 0.5) 
      : [...question.items];
  });
  const [showFeedback, setShowFeedback] = useState(false);
  const [draggedItem, setDraggedItem] = useState<OrderingItem | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const { playSound } = useAudio();
  const isMobile = useIsMobile();

  const handleDragStart = (e: React.DragEvent, item: OrderingItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the container, not moving between items
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDraggedOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const draggedIndex = orderedItems.findIndex(item => item.id === draggedItem.id);
    if (draggedIndex === dropIndex) return;
    
    const newItems = [...orderedItems];
    newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    setOrderedItems(newItems);
    setDraggedItem(null);
    setDraggedOverIndex(null);
    playSound('click');
  };

  const handleSubmit = () => {
    setShowFeedback(true);
    
    // Check if the order is correct
    const isCorrect = orderedItems.every((item, index) => {
      return item.correctOrder === index + 1;
    });
    
    if (isCorrect) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }
  };

  const handleContinue = () => {
    // Check if the order is correct
    const isCorrect = orderedItems.every((item, index) => {
      return item.correctOrder === index + 1;
    });
    
    playSound('navigate');
    onAnswer(isCorrect);
  };

  // Add keyboard support for Enter key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (showFeedback) {
          handleContinue();
        } else {
          handleSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showFeedback, handleContinue, handleSubmit]);

  const getFeedbackMessage = () => {
    const isCorrect = orderedItems.every((item, index) => {
      return item.correctOrder === index + 1;
    });
    
    if (isCorrect) {
      return 'Correct! You have arranged the items in the proper order.';
    } else {
      const correctOrder = [...question.items].sort((a, b) => a.correctOrder - b.correctOrder);
      return `Incorrect. The correct order is: ${correctOrder.map(item => `${item.correctOrder}. ${item.text}`).join(', ')}`;
    }
  };

  const getFeedbackSeverity = () => {
    const isCorrect = orderedItems.every((item, index) => {
      return item.correctOrder === index + 1;
    });
    return isCorrect ? 'success' : 'error';
  };

  return (
    <NodeCard animate={true}>
      <Box sx={{ mb: 3 }}>
        {question.media && (
          <Box sx={{ mb: 3 }}>
            <MediaViewer media={question.media} size="medium" />
          </Box>
        )}
        
        {question.additionalMediaList && question.additionalMediaList.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <MediaDisplay 
              mediaList={question.additionalMediaList.map(wrapper => wrapper.media)}
              size="small"
              showControls={true}
              showCounter={true}
            />
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

      <Typography sx={{ mb: 2, color: 'text.secondary' }}>
        Drag and drop the items below to arrange them in the correct order:
      </Typography>

      <Box sx={{ mb: 3 }}>
        {orderedItems.map((item, index) => (
          <Paper
            key={item.id}
            draggable={!showFeedback}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            sx={{
              p: 2,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              cursor: showFeedback ? 'default' : 'move',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              border: draggedOverIndex === index ? '2px dashed' : '1px solid',
              borderColor: draggedOverIndex === index ? 'primary.main' : 'divider',
              backgroundColor: draggedOverIndex === index ? 'action.hover' : 'background.paper',
              '&:hover': !showFeedback ? {
                backgroundColor: 'action.hover',
                borderColor: 'primary.main',
              } : {},
              opacity: draggedItem?.id === item.id ? 0.5 : 1,
            }}
          >
            <IconButton
              size="small"
              disabled={showFeedback}
              sx={{ mr: 1, cursor: showFeedback ? 'default' : 'grab' }}
            >
              <DragIndicator color={showFeedback ? 'disabled' : 'action'} />
            </IconButton>
            
            <Typography sx={{ flex: 1 }}>
              {index + 1}. {item.text}
            </Typography>
            
            {showFeedback && item.correctOrder === index + 1 && (
              <CheckCircle color="success" sx={{ ml: 1 }} />
            )}
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={showFeedback}
          sx={{ borderRadius: 3, minWidth: 120 }}
        >
          Submit Order
        </Button>
      </Box>

      {showFeedback && (
        <Box sx={{ mt: 2 }}>
          <Alert 
            severity={getFeedbackSeverity() as 'success' | 'error'} 
            sx={{ 
              borderRadius: 2,
              mb: 2,
              '& .MuiAlert-message': {
                width: '100%',
                textAlign: 'center'
              }
            }}
          >
            {getFeedbackMessage()}
          </Alert>
          
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              onClick={handleContinue}
              size="large"
              sx={{ 
                borderRadius: 3, 
                minWidth: 120,
                px: 4,
                py: 1.5
              }}
            >
              Continue
            </Button>
          </Box>
        </Box>
      )}
      
      {/* Keyboard Controls Helper - Hide on mobile */}
      {!isMobile && (
        <FormHelperText sx={{ textAlign: 'center', mt: 1, fontSize: '0.75rem', opacity: 0.7 }}>
          {showFeedback ? 'Press Enter to continue' : 'Press Enter to submit'}
        </FormHelperText>
      )}
    </NodeCard>
  );
};