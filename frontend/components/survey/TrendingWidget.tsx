/**
 * TrendingWidget Component
 * Shows trend analysis with semantic color coding and directional indicators
 * Based on Figma design with percentage changes and trend classifications
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  TrendingUp, 
  TrendingDown, 
  TrendingFlat,
  KeyboardDoubleArrowUp,
  KeyboardDoubleArrowDown,
  Remove
} from '@mui/icons-material';
import { useSurveyColors } from '../../theme/surveyTheme';

export interface TrendData {
  /** Current value */
  currentValue: number;
  
  /** Previous value for comparison */
  previousValue: number;
  
  /** Optional custom trend label */
  label?: string;
  
  /** Value unit (%, pts, etc.) */
  unit?: string;
  
  /** Metric name or description */
  metric?: string;
  
  /** Whether higher values are better (default: true) */
  higherIsBetter?: boolean;
}

export interface TrendingWidgetProps {
  /** Trend analysis data */
  trend: TrendData;
  
  /** Widget size variant */
  size?: 'small' | 'medium' | 'large';
  
  /** Show percentage change */
  showPercentage?: boolean;
  
  /** Show absolute change */
  showAbsolute?: boolean;
  
  /** Show trend icon */
  showIcon?: boolean;
  
  /** Show current value */
  showCurrentValue?: boolean;
  
  /** Compact layout */
  compact?: boolean;
  
  /** Additional CSS class */
  className?: string;
}

export const TrendingWidget: React.FC<TrendingWidgetProps> = ({
  trend,
  size = 'medium',
  showPercentage = true,
  showAbsolute = false,
  showIcon = true,
  showCurrentValue = true,
  compact = false,
  className,
}) => {
  const theme = useTheme();
  const surveyColors = useSurveyColors();

  // Calculate trend metrics
  const getTrendMetrics = () => {
    const absoluteChange = trend.currentValue - trend.previousValue;
    const percentageChange = trend.previousValue !== 0 
      ? (absoluteChange / Math.abs(trend.previousValue)) * 100 
      : 0;
    
    // Determine trend classification
    let classification: 'skyrocketing' | 'trending-up' | 'steady' | 'trending-down' | 'plummeting';
    let icon;
    
    if (percentageChange > 25) {
      classification = 'skyrocketing';
      icon = KeyboardDoubleArrowUp;
    } else if (percentageChange > 6) {
      classification = 'trending-up';
      icon = TrendingUp;
    } else if (percentageChange >= -5) {
      classification = 'steady';
      icon = TrendingFlat;
    } else if (percentageChange >= -24) {
      classification = 'trending-down';
      icon = TrendingDown;
    } else {
      classification = 'plummeting';
      icon = KeyboardDoubleArrowDown;
    }

    // Override icon for steady trend
    if (classification === 'steady') {
      icon = Remove;
    }

    return {
      absoluteChange,
      percentageChange,
      classification,
      icon,
      isPositive: absoluteChange > 0,
      isNeutral: Math.abs(percentageChange) < 5,
      isSignificant: Math.abs(percentageChange) >= 10,
    };
  };

  // Get trend label
  const getTrendLabel = (classification: string): string => {
    if (trend.label) return trend.label;
    
    switch (classification) {
      case 'skyrocketing':
        return trend.higherIsBetter !== false ? 'Skyrocketing' : 'Plummeting';
      case 'trending-up':
        return trend.higherIsBetter !== false ? 'Trending Up' : 'Trending Down';
      case 'steady':
        return 'Steady';
      case 'trending-down':
        return trend.higherIsBetter !== false ? 'Trending Down' : 'Trending Up';
      case 'plummeting':
        return trend.higherIsBetter !== false ? 'Plummeting' : 'Skyrocketing';
      default:
        return 'Unknown Trend';
    }
  };

  // Get size-based styling
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: compact ? 6 : 8,
          iconSize: 16,
          valueFont: '1rem',
          changeFont: '0.75rem',
          labelFont: '0.625rem',
          metricFont: '0.625rem',
          spacing: 4,
          minHeight: compact ? 32 : 48,
        };
      case 'large':
        return {
          padding: compact ? 16 : 20,
          iconSize: 32,
          valueFont: '1.75rem',
          changeFont: '1.125rem',
          labelFont: '0.875rem',
          metricFont: '0.875rem',
          spacing: 12,
          minHeight: compact ? 80 : 120,
        };
      default: // medium
        return {
          padding: compact ? 10 : 12,
          iconSize: 24,
          valueFont: '1.25rem',
          changeFont: '1rem',
          labelFont: '0.75rem',
          metricFont: '0.75rem',
          spacing: 8,
          minHeight: compact ? 56 : 80,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const metrics = getTrendMetrics();
  const trendColor = surveyColors.getTrendingColor(metrics.percentageChange);
  const trendLabel = getTrendLabel(metrics.classification);
  const IconComponent = metrics.icon;

  // Format change display
  const formatChange = () => {
    const parts = [];
    
    if (showAbsolute) {
      const sign = metrics.absoluteChange > 0 ? '+' : '';
      parts.push(`${sign}${metrics.absoluteChange.toFixed(1)}${trend.unit || ''}`);
    }
    
    if (showPercentage) {
      const sign = metrics.percentageChange > 0 ? '+' : '';
      parts.push(`${sign}${metrics.percentageChange.toFixed(1)}%`);
    }
    
    return parts.join(' ');
  };

  const changeDisplay = formatChange();

  if (compact) {
    return (
      <Box
        className={className}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: sizeStyles.spacing / 2,
          padding: sizeStyles.padding,
          minHeight: sizeStyles.minHeight,
          backgroundColor: theme.palette.background.paper,
          borderLeft: `4px solid ${trendColor}`,
          borderRadius: 1,
        }}
      >
        {showIcon && IconComponent && (
          <IconComponent
            sx={{
              fontSize: sizeStyles.iconSize,
              color: trendColor,
            }}
          />
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontSize: sizeStyles.changeFont,
              fontWeight: 700,
              color: trendColor,
              lineHeight: 1,
            }}
          >
            {changeDisplay}
          </Typography>
          
          <Typography
            variant="caption"
            sx={{
              fontSize: sizeStyles.labelFont,
              color: theme.palette.text.secondary,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {trend.metric || trendLabel}
          </Typography>
        </Box>

        {showCurrentValue && (
          <Typography
            variant="body1"
            sx={{
              fontSize: sizeStyles.metricFont,
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            {trend.currentValue}{trend.unit || ''}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: sizeStyles.padding,
        minHeight: sizeStyles.minHeight,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: theme.palette.mode === 'light' 
            ? `0 2px 8px ${trendColor}20` 
            : `0 2px 8px rgba(0,0,0,0.3)`,
          borderColor: trendColor,
        },
      }}
    >
      {/* Current Value */}
      {showCurrentValue && (
        <Typography
          variant="h4"
          component="div"
          sx={{
            fontSize: sizeStyles.valueFont,
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1,
            marginBottom: sizeStyles.spacing / 2,
          }}
        >
          {trend.currentValue}{trend.unit || ''}
        </Typography>
      )}

      {/* Trend Change */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: sizeStyles.spacing / 2,
          marginBottom: sizeStyles.spacing / 2,
        }}
      >
        {showIcon && IconComponent && (
          <IconComponent
            sx={{
              fontSize: sizeStyles.iconSize,
              color: trendColor,
            }}
          />
        )}
        
        <Typography
          variant="body1"
          sx={{
            fontSize: sizeStyles.changeFont,
            fontWeight: 700,
            color: trendColor,
            lineHeight: 1,
          }}
        >
          {changeDisplay}
        </Typography>
      </Box>

      {/* Trend Label */}
      <Typography
        variant="body2"
        sx={{
          fontSize: sizeStyles.labelFont,
          fontWeight: 600,
          color: theme.palette.text.secondary,
          textAlign: 'center',
          lineHeight: 1.2,
          marginBottom: trend.metric ? sizeStyles.spacing / 4 : 0,
        }}
      >
        {trendLabel}
      </Typography>

      {/* Metric Description */}
      {trend.metric && (
        <Typography
          variant="caption"
          sx={{
            fontSize: sizeStyles.metricFont,
            color: theme.palette.text.secondary,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {trend.metric}
        </Typography>
      )}

      {/* Significance Indicator */}
      {metrics.isSignificant && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: trendColor,
            opacity: 0.8,
          }}
        />
      )}
    </Box>
  );
};

/**
 * Trending Widget with predefined configurations
 */
export interface TrendingWidgetVariantProps extends Omit<TrendingWidgetProps, 'trend'> {
  /** Trend variant type */
  variant: 'performance' | 'satisfaction' | 'engagement' | 'response-rate' | 'completion' | 'custom';
  
  /** Current metric value */
  currentValue: number;
  
  /** Previous metric value */
  previousValue: number;
  
  /** Custom metric description */
  metric?: string;
  
  /** Value unit (%, pts, etc.) */
  unit?: string;
}

export const TrendingWidgetVariant: React.FC<TrendingWidgetVariantProps> = ({
  variant,
  currentValue,
  previousValue,
  metric,
  unit,
  ...props
}) => {
  // Define variant configurations
  const getVariantConfig = () => {
    switch (variant) {
      case 'performance':
        return {
          metric: metric || 'Performance Score',
          unit: unit || '%',
          higherIsBetter: true,
        };
      case 'satisfaction':
        return {
          metric: metric || 'Satisfaction Rating',
          unit: unit || '/5',
          higherIsBetter: true,
        };
      case 'engagement':
        return {
          metric: metric || 'Engagement Level',
          unit: unit || '%',
          higherIsBetter: true,
        };
      case 'response-rate':
        return {
          metric: metric || 'Response Rate',
          unit: unit || '%',
          higherIsBetter: true,
        };
      case 'completion':
        return {
          metric: metric || 'Completion Rate',
          unit: unit || '%',
          higherIsBetter: true,
        };
      case 'custom':
      default:
        return {
          metric: metric || 'Metric Value',
          unit: unit || '',
          higherIsBetter: true,
        };
    }
  };

  const config = getVariantConfig();
  const trendData: TrendData = {
    currentValue,
    previousValue,
    ...config,
  };

  return <TrendingWidget trend={trendData} {...props} />;
};

export default TrendingWidget;