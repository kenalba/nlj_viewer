import React, { useState, ReactNode } from 'react';
import { Card, CardContent, Box, Fade, Grow, useTheme as useMuiTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '../contexts/ThemeContext';

interface NodeCardProps {
  children: ReactNode;
  variant?: 'default' | 'question' | 'choice' | 'interstitial' | 'media';
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  animate?: boolean;
  elevation?: number;
  sx?: SxProps<Theme>;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  children,
  variant = 'default',
  interactive = false,
  selected = false,
  onClick,
  animate = true,
  elevation = 0,
  sx = {},
}) => {
  const { themeMode } = useTheme();
  const muiTheme = useMuiTheme();
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = () => {
    const isUnfiltered = themeMode === 'unfiltered';
    const baseStyles = {
      borderRadius: { xs: 0, sm: muiTheme.shape.borderRadius },
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'visible',
      backgroundColor: 'background.paper',
      minHeight: { xs: '100%', sm: 'auto' },
      width: '100%',
      height: { xs: '100%', sm: 'auto' },
      ...(isUnfiltered && {
        background: 'linear-gradient(135deg, #1A1A1A 0%, #262626 100%)',
        border: { xs: 'none', sm: '1px solid #333333' },
      }),
    };

    switch (variant) {
      case 'question':
        return {
          ...baseStyles,
          ...(isUnfiltered && {
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }),
        };

      case 'choice':
        return {
          ...baseStyles,
          cursor: interactive ? 'pointer' : 'default',
          ...(isUnfiltered && {
            backgroundColor: selected ? 'rgba(246, 250, 36, 0.1)' : '#1A1A1A',
            borderColor: selected ? '#F6FA24' : '#333333',
            borderWidth: '2px',
            boxShadow: selected 
              ? '0 4px 20px rgba(246, 250, 36, 0.2)' 
              : '0 2px 12px rgba(0, 0, 0, 0.2)',
          }),
        };

      case 'interstitial':
        return {
          ...baseStyles,
          ...(isUnfiltered && {
            background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
          }),
        };

      case 'media':
        return {
          ...baseStyles,
          ...(isUnfiltered && {
            overflow: 'visible',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }),
        };

      default:
        return baseStyles;
    }
  };

  const getHoverStyles = () => {
    const isUnfiltered = themeMode === 'unfiltered';
    if (!interactive || !isUnfiltered) return {};

    return {
      transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
      boxShadow: isHovered 
        ? '0 16px 48px rgba(246, 250, 36, 0.15), 0 0 20px rgba(246, 250, 36, 0.1)' 
        : '0 8px 32px rgba(0, 0, 0, 0.3)',
      borderColor: isHovered ? '#F6FA24' : '#333333',
    };
  };

  const getAnimationProps = () => {
    if (!animate) return {};
    
    return {
      in: true,
      timeout: { enter: 600, exit: 300 },
      style: {
        transitionDelay: '100ms',
      },
    };
  };

  const cardContent = (
    <Card
      elevation={elevation}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={[
        getVariantStyles(),
        getHoverStyles(),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <CardContent
        sx={{
          p: variant === 'media' ? 0 : 3,
          '&:last-child': {
            pb: variant === 'media' ? 0 : 3,
          },
        }}
      >
        {children}
      </CardContent>
    </Card>
  );

  if (animate && themeMode === 'unfiltered') {
    return (
      <Grow {...getAnimationProps()}>
        <Fade {...getAnimationProps()}>
          <Box>{cardContent}</Box>
        </Fade>
      </Grow>
    );
  }

  return cardContent;
};