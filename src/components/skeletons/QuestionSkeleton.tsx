import React from 'react';
import { Box, Skeleton, Stack, Card, CardContent, useTheme } from '@mui/material';
import { useTheme as useAppTheme } from '../../contexts/ThemeContext';

interface QuestionSkeletonProps {
  hasMedia?: boolean;
  choiceCount?: number;
  hasMultipleMedia?: boolean;
  questionType?: 'multiple_choice' | 'true_false' | 'ordering' | 'matching' | 'short_answer' | 'likert' | 'rating' | 'slider' | 'textarea' | 'matrix';
  animate?: boolean;
}

export const QuestionSkeleton: React.FC<QuestionSkeletonProps> = ({
  hasMedia = false,
  choiceCount = 4,
  hasMultipleMedia = false,
  questionType = 'multiple_choice',
  animate = true
}) => {
  const theme = useTheme();
  const { themeMode } = useAppTheme();
  
  // Enhanced skeleton with subtle animation
  const SkeletonWithPulse: React.FC<{ 
    children: React.ReactNode; 
    delay?: number;
  }> = ({ children, delay = 0 }) => (
    <Box
      sx={{
        opacity: 0,
        animation: animate ? `fadeInSkeleton 0.6s ease-in-out ${delay}s forwards` : 'none',
        '@keyframes fadeInSkeleton': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      {children}
    </Box>
  );

  const renderQuestionTitle = () => (
    <SkeletonWithPulse delay={0.1}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Skeleton 
          variant="text" 
          height={36} 
          width="85%" 
          sx={{ fontSize: '1.5rem' }}
        />
        <Skeleton 
          variant="text" 
          height={24} 
          width="65%" 
          sx={{ fontSize: '1rem' }}
        />
      </Stack>
    </SkeletonWithPulse>
  );

  const renderMediaSkeleton = () => {
    if (!hasMedia) return null;
    
    return (
      <SkeletonWithPulse delay={0.2}>
        <Box sx={{ mb: 3 }}>
          <Card elevation={1} sx={{ 
            backgroundColor: theme.palette.grey[50],
            border: `1px solid ${theme.palette.grey[200]}`,
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <Box sx={{ position: 'relative' }}>
              <Skeleton 
                variant="rectangular" 
                height={300}
                sx={{ 
                  backgroundColor: theme.palette.grey[100],
                  '&::after': {
                    background: `linear-gradient(90deg, transparent, ${theme.palette.grey[50]}, transparent)`,
                  }
                }}
              />
              
              {/* Media type indicator */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: theme.palette.grey[400]
              }}>
                <Skeleton 
                  variant="circular" 
                  width={48} 
                  height={48} 
                  sx={{ mb: 1 }}
                />
                <Skeleton 
                  variant="text" 
                  width={120} 
                  height={20}
                />
              </Box>
            </Box>
          </Card>
          
          {/* Multiple media items */}
          {hasMultipleMedia && (
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              {[1, 2].map((item) => (
                <Box key={item} sx={{ flex: 1 }}>
                  <Skeleton 
                    variant="rectangular" 
                    height={150}
                    sx={{ borderRadius: 2 }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </SkeletonWithPulse>
    );
  };

  const renderChoicesSkeleton = () => {
    if (questionType === 'true_false') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
            <Skeleton 
              variant="rectangular" 
              width={120} 
              height={48}
              sx={{ borderRadius: 3 }}
            />
            <Skeleton 
              variant="rectangular" 
              width={120} 
              height={48}
              sx={{ borderRadius: 3 }}
            />
          </Stack>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'slider') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Box sx={{ mb: 3, px: 2 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
              <Skeleton variant="text" width={80} />
              <Skeleton variant="text" width={80} />
            </Stack>
            <Skeleton 
              variant="rectangular" 
              height={8}
              sx={{ borderRadius: 4 }}
            />
            <Box sx={{ 
              position: 'relative', 
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Skeleton 
                variant="circular" 
                width={24} 
                height={24}
                sx={{ 
                  position: 'absolute',
                  left: '60%',
                  transform: 'translateX(-50%)'
                }}
              />
            </Box>
          </Box>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'rating') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mb: 3,
            gap: 1
          }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Skeleton 
                key={star}
                variant="circular" 
                width={32} 
                height={32}
              />
            ))}
          </Box>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'likert') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mb: 3,
            gap: 1,
            flexWrap: 'wrap'
          }}>
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton 
                key={item}
                variant="rectangular" 
                width={60} 
                height={48}
                sx={{ borderRadius: 3 }}
              />
            ))}
          </Box>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'matrix') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Box sx={{ mb: 3 }}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                {/* Matrix header */}
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  <Skeleton variant="text" width={120} />
                  <Skeleton variant="text" width={80} />
                  <Skeleton variant="text" width={80} />
                  <Skeleton variant="text" width={80} />
                </Stack>
                
                {/* Matrix rows */}
                {[1, 2, 3].map((row) => (
                  <Stack key={row} direction="row" spacing={2} sx={{ mb: 1 }}>
                    <Skeleton variant="text" width={120} />
                    <Skeleton variant="circular" width={24} height={24} />
                    <Skeleton variant="circular" width={24} height={24} />
                    <Skeleton variant="circular" width={24} height={24} />
                  </Stack>
                ))}
              </CardContent>
            </Card>
          </Box>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'short_answer' || questionType === 'textarea') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Box sx={{ mb: 3 }}>
            <Skeleton 
              variant="rectangular" 
              height={questionType === 'textarea' ? 120 : 56}
              sx={{ borderRadius: 2 }}
            />
          </Box>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'ordering') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Stack spacing={2} sx={{ mb: 3 }}>
            {Array.from({ length: Math.min(choiceCount, 5) }, (_, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} />
                <Skeleton variant="text" width={`${60 + (i * 10)}%`} height={48} />
                <Skeleton variant="rectangular" width={24} height={24} sx={{ borderRadius: 1 }} />
              </Box>
            ))}
          </Stack>
        </SkeletonWithPulse>
      );
    }

    if (questionType === 'matching') {
      return (
        <SkeletonWithPulse delay={0.4}>
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={4}>
              {/* Left column */}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={2}>
                  {[1, 2, 3, 4].map((item) => (
                    <Skeleton 
                      key={item}
                      variant="rectangular" 
                      height={56}
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Stack>
              </Box>
              
              {/* Right column */}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={2}>
                  {[1, 2, 3, 4].map((item) => (
                    <Skeleton 
                      key={item}
                      variant="rectangular" 
                      height={56}
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </SkeletonWithPulse>
      );
    }

    // Default: Multiple choice
    return (
      <SkeletonWithPulse delay={0.4}>
        <Stack spacing={2} sx={{ mb: 3 }}>
          {Array.from({ length: Math.min(choiceCount, 6) }, (_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton 
                variant="text" 
                width={`${Math.max(40, 90 - (i * 10))}%`} 
                height={48}
              />
            </Box>
          ))}
        </Stack>
      </SkeletonWithPulse>
    );
  };

  const renderSubmitButton = () => (
    <SkeletonWithPulse delay={0.6}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Skeleton 
          variant="rectangular" 
          width={120} 
          height={48}
          sx={{ borderRadius: 3 }}
        />
      </Box>
    </SkeletonWithPulse>
  );

  const renderHelperText = () => (
    <SkeletonWithPulse delay={0.7}>
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Skeleton 
          variant="text" 
          width={200} 
          height={16}
          sx={{ margin: '0 auto', mb: 1 }}
        />
        <Skeleton 
          variant="text" 
          width={300} 
          height={14}
          sx={{ margin: '0 auto', opacity: 0.6 }}
        />
      </Box>
    </SkeletonWithPulse>
  );

  return (
    <Card 
      elevation={2} 
      sx={{ 
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 4 }}>
        {renderQuestionTitle()}
        {renderMediaSkeleton()}
        {renderChoicesSkeleton()}
        {renderSubmitButton()}
        {renderHelperText()}
      </CardContent>
      
      {/* Subtle loading indicator */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${themeMode === 'unfiltered' ? '#F6FA24' : theme.palette.primary.main}, transparent)`,
        animation: animate ? 'loadingBar 2s ease-in-out infinite' : 'none',
        '@keyframes loadingBar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }} />
    </Card>
  );
};