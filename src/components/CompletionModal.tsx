import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Button,
  Box,
  Stack,
  Slide,
  IconButton,
  useTheme as useMuiTheme,
} from '@mui/material';
import { Analytics, Home, Refresh, Close } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import confetti from 'canvas-confetti';

interface CompletionModalProps {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  onGoHome: () => void;
  onViewResults?: () => void;
  scenarioName: string;
  score?: number;
  xapiEnabled?: boolean;
}

const Transition = React.forwardRef(function Transition(props: any, ref: React.Ref<unknown>) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export const CompletionModal: React.FC<CompletionModalProps> = ({
  open,
  onClose,
  onRestart,
  onGoHome,
  onViewResults,
  scenarioName,
  score,
  xapiEnabled = false,
}) => {
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();
  const [showCelebration, setShowCelebration] = useState(false);

  // Trigger confetti when modal opens
  React.useEffect(() => {
    if (open && !showCelebration) {
      setShowCelebration(true);
      // Confetti animation
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }, 250);
    }
  }, [open, showCelebration]);

  const handleGoHome = () => {
    onClose();
    onGoHome();
  };

  const handleRestart = () => {
    onClose();
    onRestart();
  };

  const handleViewResults = () => {
    onClose();
    onViewResults?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 3,
          ...(themeMode === 'unfiltered' && {
            backgroundColor: '#000000',
            border: '2px solid #F6FA24',
          }),
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'text.secondary',
            zIndex: 1,
          }}
        >
          <Close />
        </IconButton>
        
        <DialogContent sx={{ textAlign: 'center', pt: 4, pb: 4 }}>
          {/* Celebration Icon */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h1" sx={{ fontSize: '4rem', mb: 1 }}>
              🎉
            </Typography>
            <Typography variant="h4" gutterBottom color="primary">
              Congratulations!
            </Typography>
            <Typography variant="h6" color="text.secondary">
              You have completed
            </Typography>
            <Typography variant="h5" sx={{ mt: 1, mb: 2 }}>
              {scenarioName}
            </Typography>
          </Box>

          {/* Score Display */}
          {score !== undefined && (
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              borderRadius: 2, 
              backgroundColor: themeMode === 'unfiltered' ? '#F6FA24' : 'primary.main',
              color: themeMode === 'unfiltered' ? '#000000' : '#ffffff',
            }}>
              <Typography variant="h6">
                Final Score: {score}
              </Typography>
            </Box>
          )}

          {/* Action Buttons */}
          <Stack direction="column" spacing={2} sx={{ mt: 4 }}>
            {xapiEnabled && onViewResults && (
              <Button
                variant="contained"
                startIcon={<Analytics />}
                onClick={handleViewResults}
                size="large"
                sx={{
                  borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                  ...(themeMode === 'unfiltered' && {
                    backgroundColor: '#F6FA24',
                    color: '#000000',
                    '&:hover': {
                      backgroundColor: '#FFD700',
                    },
                  }),
                }}
              >
                View Learning Summary
              </Button>
            )}
            
            <Button
              variant="contained"
              startIcon={<Home />}
              onClick={handleGoHome}
              size="large"
              sx={{
                borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                ...(themeMode === 'unfiltered' && {
                  backgroundColor: '#F6FA24',
                  color: '#000000',
                  '&:hover': {
                    backgroundColor: '#FFD700',
                  },
                }),
              }}
            >
              Back to Home
            </Button>

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRestart}
              size="large"
              sx={{
                borderRadius: (muiTheme.shape.borderRadius as number) * 3,
                ...(themeMode === 'unfiltered' && {
                  borderColor: '#F6FA24',
                  color: '#F6FA24',
                  '&:hover': {
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(246, 250, 36, 0.1)',
                    color: '#FFD700',
                  },
                }),
              }}
            >
              Try Again
            </Button>
          </Stack>
        </DialogContent>
      </Box>
    </Dialog>
  );
};