/**
 * HorizontalBarChart Component
 * Displays response distribution as stacked horizontal bars
 * Based on Figma design specifications with 5 variants
 */

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSurveyColors } from '../../theme/surveyTheme';

export interface ResponseDistribution {
  [key: string]: number; // e.g., { "positive": 65, "passive": 15, "negative": 20 }
}

export interface QuestionScale {
  type: 'likert' | 'nps' | 'binary' | 'custom';
  labels: string[];
  values: number[];
}

export interface HorizontalBarChartProps {
  /** Chart variant based on Figma designs */
  variant: '3-colors' | '2-colors' | 'small-section' | 'hover' | 'thin';
  
  /** Response distribution data */
  data: ResponseDistribution;
  
  /** Question scale information */
  scale: QuestionScale;
  
  /** Whether to show percentage labels inside bars */
  showLabels?: boolean;
  
  /** Whether to enable hover interactions */
  interactive?: boolean;
  
  /** Chart width */
  width?: string | number;
  
  /** Chart height */
  height?: number;
  
  /** Additional CSS class */
  className?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  variant,
  data,
  scale,
  showLabels = true,
  interactive = true,
  width = '100%',
  height,
  className,
}) => {
  const theme = useTheme();
  const surveyColors = useSurveyColors();

  // Get colors based on scale type
  const colors = surveyColors.getResponseColors(scale.type, Object.keys(data).length);

  // Calculate total and percentages
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);
  const percentages = Object.keys(data).reduce((acc, key) => {
    acc[key] = total > 0 ? (data[key] / total) * 100 : 0;
    return acc;
  }, {} as ResponseDistribution);

  // Get variant-specific styling
  const getVariantStyles = () => {
    switch (variant) {
      case '3-colors':
        return {
          height: height || 40,
          borderRadius: 8,
          showLabels: true,
          fontSize: '14px',
          fontWeight: 600,
        };
      case '2-colors':
        return {
          height: height || 32,
          borderRadius: 6,
          showLabels: true,
          fontSize: '13px',
          fontWeight: 500,
        };
      case 'small-section':
        return {
          height: height || 24,
          borderRadius: 4,
          showLabels: false,
          fontSize: '12px',
          fontWeight: 500,
        };
      case 'hover':
        return {
          height: height || 40,
          borderRadius: 8,
          showLabels: true,
          fontSize: '14px',
          fontWeight: 600,
          hover: true,
        };
      case 'thin':
        return {
          height: height || 16,
          borderRadius: 2,
          showLabels: false,
          fontSize: '11px',
          fontWeight: 400,
        };
      default:
        return {
          height: height || 32,
          borderRadius: 6,
          showLabels: true,
          fontSize: '13px',
          fontWeight: 500,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Create bar segments
  const segments = Object.keys(data).map((key, index) => {
    const percentage = percentages[key];
    const color = colors[index] || theme.palette.grey[400];
    
    if (percentage === 0) return null;

    const showLabel = showLabels && variantStyles.showLabels && percentage >= 8; // Only show label if >= 8%

    return (
      <Box
        key={key}
        sx={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.palette.getContrastText(color),
          fontSize: variantStyles.fontSize,
          fontWeight: variantStyles.fontWeight,
          transition: interactive ? 'all 0.2s ease-in-out' : undefined,
          cursor: interactive ? 'pointer' : 'default',
          '&:hover': interactive && variantStyles.hover ? {
            opacity: 0.8,
            transform: 'translateY(-1px)',
          } : undefined,
          // Ensure text is readable
          textShadow: theme.palette.mode === 'dark' ? '0 1px 2px rgba(0,0,0,0.8)' : undefined,
        }}
      >
        {showLabel && `${Math.round(percentage)}%`}
      </Box>
    );
  }).filter(Boolean);

  const chartContent = (
    <Box
      className={className}
      sx={{
        width: width,
        height: variantStyles.height,
        display: 'flex',
        borderRadius: `${variantStyles.borderRadius}px`,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.palette.mode === 'light' ? '0 1px 3px rgba(0,0,0,0.1)' : undefined,
      }}
    >
      {segments}
    </Box>
  );

  // Wrap in tooltip if interactive
  if (interactive) {
    const tooltipContent = Object.keys(data)
      .map((key, index) => {
        const count = data[key];
        const percentage = percentages[key];
        const label = scale.labels[index] || key;
        return `${label}: ${count} (${Math.round(percentage)}%)`;
      })
      .join('\n');

    return (
      <Tooltip
        title={
          <Box sx={{ whiteSpace: 'pre-line' }}>
            <Typography variant="body2">{tooltipContent}</Typography>
          </Box>
        }
        placement="top"
        arrow
      >
        {chartContent}
      </Tooltip>
    );
  }

  return chartContent;
};

/**
 * Stacked Bar Chart for survey data with legend
 * Includes color legend below the chart
 */
export interface HorizontalBarChartWithLegendProps extends HorizontalBarChartProps {
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
}

export const HorizontalBarChartWithLegend: React.FC<HorizontalBarChartWithLegendProps> = ({
  showLegend = true,
  legendPosition = 'bottom',
  ...chartProps
}) => {
  const theme = useTheme();
  const surveyColors = useSurveyColors();

  const colors = surveyColors.getResponseColors(chartProps.scale.type, Object.keys(chartProps.data).length);

  const legend = showLegend && (
    <Box
      sx={{
        display: 'flex',
        flexDirection: legendPosition === 'bottom' ? 'row' : 'column',
        gap: 2,
        mt: legendPosition === 'bottom' ? 1 : 0,
        ml: legendPosition === 'right' ? 2 : 0,
        flexWrap: 'wrap',
        justifyContent: legendPosition === 'bottom' ? 'center' : 'flex-start',
      }}
    >
      {Object.keys(chartProps.data).map((key, index) => {
        const label = chartProps.scale.labels[index] || key;
        const color = colors[index] || theme.palette.grey[400];
        
        return (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: 2,
                backgroundColor: color,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: legendPosition === 'bottom' ? 'column' : 'row',
        alignItems: legendPosition === 'bottom' ? 'stretch' : 'center',
      }}
    >
      <HorizontalBarChart {...chartProps} />
      {legend}
    </Box>
  );
};

export default HorizontalBarChart;