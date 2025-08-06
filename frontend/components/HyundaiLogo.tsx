/**
 * Hyundai Logo Component
 * Uses the official Hyundai logo SVG for consistent branding
 * Logo source: https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg
 */

import React from 'react';
import { Box, BoxProps } from '@mui/material';

interface HyundaiLogoProps extends Omit<BoxProps, 'component'> {
  variant?: 'full' | 'mark' | 'wordmark';
  height?: number | string;
}

export const HyundaiLogo: React.FC<HyundaiLogoProps> = ({ 
  variant = 'wordmark', 
  height = 40,
  sx,
  ...props 
}) => {
  // For the mark variant, we'll use the Hyundai symbol
  if (variant === 'mark') {
    return (
      <Box
        component="img"
        src="/static/hyundai-symbol.svg"
        alt="Hyundai"
        sx={{
          height: height,
          width: 'auto',
          objectFit: 'contain',
          ...sx
        }}
        {...props}
      />
    );
  }

  // For wordmark, we'll combine the logo with our custom text
  if (variant === 'wordmark') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0.5,
          width: '100%',
          ...sx
        }}
        {...props}
      >
        <Box
          component="img"
          src="/static/hyundai-logo.svg"
          alt="Hyundai"
          sx={{
            height: height,
            width: '100%',
            objectFit: 'contain',
            objectPosition: 'left center',
          }}
        />
        <Box
          component="span"
          sx={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: typeof height === 'number' ? `${height * 0.6}px` : '16px',
            fontWeight: 700,
            color: 'currentColor',
            opacity: 0.75,
            letterSpacing: '0.2px',
            lineHeight: 1.2,
            textAlign: 'left',
            width: '100%'
          }}
        >
          Content Studio
        </Box>
      </Box>
    );
  }

  // Full logo - use the complete SVG
  return (
    <Box
      component="img"
      src="/static/hyundai-logo.svg"
      alt="Hyundai"
      sx={{
        height: height,
        width: 'auto',
        objectFit: 'contain',
        ...sx
      }}
      {...props}
    />
  );
};

export default HyundaiLogo;