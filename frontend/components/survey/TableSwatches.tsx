/**
 * TableSwatches Component
 * Color-coded label swatches for survey response categories
 * Based on Figma Table Swatches design with dynamic labels
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSurveyColors } from '../../theme/surveyTheme';

export interface TableSwatchesProps {
  /** Question scale type for color selection */
  scale: 'likert' | 'nps' | 'binary' | 'custom';
  
  /** Custom labels for the scale (overrides defaults) */
  labels?: string[];
  
  /** Number of scale points */
  valueCount?: number;
  
  /** Swatch size variant */
  size?: 'small' | 'medium' | 'large';
  
  /** Whether to show text labels inside swatches */
  showLabels?: boolean;
  
  /** Layout direction */
  direction?: 'row' | 'column';
  
  /** Additional CSS class */
  className?: string;
}

export const TableSwatches: React.FC<TableSwatchesProps> = ({
  scale,
  labels,
  valueCount,
  size = 'medium',
  showLabels = true,
  direction = 'row',
  className,
}) => {
  const theme = useTheme();
  const surveyColors = useSurveyColors();

  // Get default labels based on scale type
  const getDefaultLabels = (scaleType: string, count?: number): string[] => {
    switch (scaleType) {
      case 'likert':
        if (count === 5) {
          return ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
        } else if (count === 3) {
          return ['Negative', 'Passive', 'Positive'];
        } else {
          return ['Negative', 'Passive', 'Positive'];
        }
      case 'nps':
        return ['Detractors', 'Passives', 'Promoters'];
      case 'binary':
        return ['No', 'Yes'];
      case 'custom':
        return labels || ['Option 1', 'Option 2', 'Option 3'];
      default:
        return ['Negative', 'Neutral', 'Positive'];
    }
  };

  // Get size-based styling
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          height: 20,
          fontSize: '0.7rem',
          padding: '2px 6px',
          borderRadius: 2,
          gap: 0.5,
        };
      case 'large':
        return {
          height: 36,
          fontSize: '0.875rem',
          padding: '6px 12px',
          borderRadius: 6,
          gap: 1,
        };
      default: // medium
        return {
          height: 28,
          fontSize: '0.75rem',
          padding: '4px 8px',
          borderRadius: 4,
          gap: 0.75,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const displayLabels = labels || getDefaultLabels(scale, valueCount);
  const colors = surveyColors.getResponseColors(scale, displayLabels.length);

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: direction,
        gap: sizeStyles.gap,
        alignItems: 'center',
      }}
    >
      {displayLabels.map((label, index) => {
        const color = colors[index] || theme.palette.grey[400];
        const contrastColor = theme.palette.getContrastText(color);
        
        return (
          <Box
            key={`${label}-${index}`}
            sx={{
              height: sizeStyles.height,
              backgroundColor: color,
              borderRadius: sizeStyles.borderRadius,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: sizeStyles.padding,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: showLabels ? 'auto' : sizeStyles.height,
              boxShadow: theme.palette.mode === 'light' ? '0 1px 2px rgba(0,0,0,0.1)' : undefined,
            }}
          >
            {showLabels && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: sizeStyles.fontSize,
                  fontWeight: 500,
                  color: contrastColor,
                  textAlign: 'center',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: theme.palette.mode === 'dark' ? '0 1px 2px rgba(0,0,0,0.8)' : undefined,
                }}
              >
                {label}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Table Swatches with custom labels and variants
 * Supports different label sets for different survey types
 */
export interface TableSwatchesVariantProps extends Omit<TableSwatchesProps, 'scale' | 'labels'> {
  /** Variant type with predefined label sets */
  variant: 'positive-negative' | 'excellent-poor' | 'yes-no' | 'satisfaction' | 'agreement' | 'impact';
}

export const TableSwatchesVariant: React.FC<TableSwatchesVariantProps> = ({
  variant,
  valueCount = 3,
  ...props
}) => {
  // Define variant configurations
  const getVariantConfig = () => {
    switch (variant) {
      case 'positive-negative':
        return {
          scale: 'likert' as const,
          labels: valueCount === 5 
            ? ['Very Negative', 'Negative', 'Neutral', 'Positive', 'Very Positive']
            : ['Negative', 'Neutral', 'Positive'],
        };
      case 'excellent-poor':
        return {
          scale: 'likert' as const,
          labels: valueCount === 5
            ? ['Poor', 'Below Average', 'Average', 'Good', 'Excellent']
            : ['Poor', 'Average', 'Excellent'],
        };
      case 'yes-no':
        return {
          scale: 'binary' as const,
          labels: ['No', 'Yes'],
        };
      case 'satisfaction':
        return {
          scale: 'likert' as const,
          labels: valueCount === 5
            ? ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']
            : ['Dissatisfied', 'Neutral', 'Satisfied'],
        };
      case 'agreement':
        return {
          scale: 'likert' as const,
          labels: valueCount === 5
            ? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
            : ['Disagree', 'Neutral', 'Agree'],
        };
      case 'impact':
        return {
          scale: 'likert' as const,
          labels: valueCount === 5
            ? ['No Impact', 'Minor Impact', 'Moderate Impact', 'Major Impact', 'Significant Impact']
            : ['No Impact', 'Moderate Impact', 'Significant Impact'],
        };
      default:
        return {
          scale: 'likert' as const,
          labels: ['Negative', 'Neutral', 'Positive'],
        };
    }
  };

  const config = getVariantConfig();

  return (
    <TableSwatches
      scale={config.scale}
      labels={config.labels}
      valueCount={valueCount}
      {...props}
    />
  );
};

export default TableSwatches;