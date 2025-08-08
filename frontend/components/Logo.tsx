/**
 * Logo Component
 * Theme-aware logo that switches between Hyundai and Genesis based on current theme
 * Includes click handler to toggle between light and dark modes
 * Hyundai logo source: https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg
 * Genesis logo source: https://upload.wikimedia.org/wikipedia/en/8/83/Genesis_division_emblem.svg
 */

import React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { useTheme } from '../contexts/ThemeContext';

interface LogoProps extends Omit<BoxProps, 'component'> {
  variant?: 'full' | 'mark' | 'wordmark';
  height?: number | string;
}

export const Logo: React.FC<LogoProps> = ({ 
  variant = 'wordmark', 
  height = 40,
  sx,
  ...props 
}) => {
  const { themeMode, toggleTheme } = useTheme();
  const isGenesis = themeMode === 'genesis';
  
  const handleClick = () => {
    toggleTheme();
  };
  
  // For the mark variant, we'll use the brand symbol
  if (variant === 'mark') {
    return (
      <Box
        component="img"
        src={isGenesis ? "/static/genesis-logo.svg" : "/static/hyundai-symbol.svg"}
        alt={isGenesis ? "Genesis" : "Hyundai"}
        sx={{
          height: height,
          width: '80%',
          objectFit: 'contain',
          filter: isGenesis ? 'brightness(0) invert(1)' : 'none', // Make Genesis logo white
          cursor: 'pointer',
          transition: 'opacity 0.2s ease',
          '&:hover': { opacity: 0.8 },
          ...sx
        }}
        onClick={handleClick}
        {...props}
      />
    );
  }

  // For wordmark, show just the logo without text
  if (variant === 'wordmark') {
    return (
      <Box
        component="img"
        src={isGenesis ? "/static/genesis-logo.svg" : "/static/hyundai-logo.svg"}
        alt={isGenesis ? "Genesis" : "Hyundai"}
        sx={{
          height: height,
          width: '80%',
          objectFit: 'contain',
          objectPosition: 'left center',
          filter: isGenesis ? 'brightness(0) invert(1)' : 'none', // Make Genesis logo white
          cursor: 'pointer',
          transition: 'opacity 0.2s ease',
          '&:hover': { opacity: 0.8 },
          ...sx
        }}
        onClick={handleClick}
        {...props}
      />
    );
  }

  // Full logo - use the complete SVG
  return (
    <Box
      component="img"
      src={isGenesis ? "/assets/genesis-logo.svg" : "/static/hyundai-logo.svg"}
      alt={isGenesis ? "Genesis" : "Hyundai"}
      sx={{
        height: height,
        width: '80%',
        objectFit: 'contain',
        filter: isGenesis ? 'brightness(0) invert(1)' : 'none', // Make Genesis logo white
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
        '&:hover': { opacity: 0.8 },
        ...sx
      }}
      onClick={handleClick}
      {...props}
    />
  );
};

export default Logo;