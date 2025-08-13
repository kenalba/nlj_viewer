/**
 * RankWidget Component
 * Shows percentile-based performance rankings with thumbs up/down indicators
 * Based on Figma design with semantic color coding
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ThumbUp, ThumbDown, TrendingUp, TrendingDown } from '@mui/icons-material';
import { useSurveyColors } from '../../theme/surveyTheme';

export interface RankData {
  /** Current percentile (0-100) */
  percentile: number;
  
  /** Optional previous percentile for trend comparison */
  previousPercentile?: number;
  
  /** Optional custom label (overrides auto-generated label) */
  label?: string;
  
  /** Additional context or description */
  description?: string;
}

export interface RankWidgetProps {
  /** Performance ranking data */
  rank: RankData;
  
  /** Widget size variant */
  size?: 'small' | 'medium' | 'large';
  
  /** Show trend indicator if previous percentile available */
  showTrend?: boolean;
  
  /** Show thumbs up/down icon */
  showIcon?: boolean;
  
  /** Show percentile number */
  showPercentile?: boolean;
  
  /** Additional CSS class */
  className?: string;
}

export const RankWidget: React.FC<RankWidgetProps> = ({
  rank,
  size = 'medium',
  showTrend = true,
  showIcon = true,
  showPercentile = true,
  className,
}) => {
  const theme = useTheme();
  const surveyColors = useSurveyColors();

  // Get rank label based on percentile
  const getRankLabel = (percentile: number): string => {
    if (rank.label) return rank.label;
    
    if (percentile >= 90) return 'Top 10%';
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 61) return 'Above Average';
    if (percentile >= 41) return 'Average';
    if (percentile >= 25) return 'Below Average';
    if (percentile >= 11) return 'Bottom 25%';
    return 'Bottom 10%';
  };

  // Get trend data
  const getTrendData = () => {
    if (!rank.previousPercentile || !showTrend) return null;
    
    const change = rank.percentile - rank.previousPercentile;
    const isPositive = change > 0;
    const isSignificant = Math.abs(change) >= 5; // 5+ percentile change is significant
    
    return {
      change,
      isPositive,
      isSignificant,
      icon: isPositive ? TrendingUp : TrendingDown,
      label: `${isPositive ? '+' : ''}${Math.round(change)}pts`,
    };
  };

  // Get size-based styling
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: 8,
          iconSize: 16,
          titleFont: '0.75rem',
          percentileFont: '0.875rem',
          labelFont: '0.625rem',
          spacing: 4,
          minHeight: 48,
        };
      case 'large':
        return {
          padding: 20,
          iconSize: 32,
          titleFont: '1.25rem',
          percentileFont: '1.5rem',
          labelFont: '0.875rem',
          spacing: 12,
          minHeight: 120,
        };
      default: // medium
        return {
          padding: 12,
          iconSize: 24,
          titleFont: '1rem',
          percentileFont: '1.25rem',
          labelFont: '0.75rem',
          spacing: 8,
          minHeight: 80,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const rankColor = surveyColors.getRankingColor(rank.percentile);
  const rankLabel = getRankLabel(rank.percentile);
  const trendData = getTrendData();
  const isPositiveRank = rank.percentile >= 50; // Above 50th percentile is positive

  // Determine which icon to show
  const IconComponent = showIcon 
    ? (isPositiveRank ? ThumbUp : ThumbDown)
    : null;

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
        border: `2px solid ${rankColor}`,
        borderRadius: 2,
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.palette.mode === 'light' 
            ? `0 4px 12px ${rankColor}40` 
            : `0 4px 12px rgba(0,0,0,0.4)`,
        },
      }}
    >
      {/* Trend Indicator */}
      {trendData && (
        <Box
          sx={{
            position: 'absolute',
            top: sizeStyles.spacing,
            right: sizeStyles.spacing,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            padding: '2px 6px',
            borderRadius: 1,
            backgroundColor: trendData.isPositive 
              ? theme.palette.success.main 
              : theme.palette.error.main,
            color: theme.palette.getContrastText(
              trendData.isPositive 
                ? theme.palette.success.main 
                : theme.palette.error.main
            ),
          }}
        >
          <trendData.icon sx={{ fontSize: sizeStyles.iconSize * 0.6 }} />
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: sizeStyles.labelFont,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {trendData.label}
          </Typography>
        </Box>
      )}

      {/* Main Icon */}
      {IconComponent && (
        <IconComponent
          sx={{
            fontSize: sizeStyles.iconSize,
            color: rankColor,
            marginBottom: sizeStyles.spacing / 2,
          }}
        />
      )}

      {/* Percentile */}
      {showPercentile && (
        <Typography
          variant="h6"
          component="div"
          sx={{
            fontSize: sizeStyles.percentileFont,
            fontWeight: 700,
            color: rankColor,
            lineHeight: 1,
            marginBottom: sizeStyles.spacing / 4,
          }}
        >
          {Math.round(rank.percentile)}th
        </Typography>
      )}

      {/* Rank Label */}
      <Typography
        variant="body2"
        component="div"
        sx={{
          fontSize: sizeStyles.titleFont,
          fontWeight: 600,
          color: theme.palette.text.primary,
          textAlign: 'center',
          lineHeight: 1.2,
          marginBottom: rank.description ? sizeStyles.spacing / 2 : 0,
        }}
      >
        {rankLabel}
      </Typography>

      {/* Description */}
      {rank.description && (
        <Typography
          variant="caption"
          sx={{
            fontSize: sizeStyles.labelFont,
            color: theme.palette.text.secondary,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {rank.description}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Rank Widget with predefined configurations
 */
export interface RankWidgetVariantProps extends Omit<RankWidgetProps, 'rank'> {
  /** Rank variant type */
  variant: 'performance' | 'satisfaction' | 'engagement' | 'compliance' | 'custom';
  
  /** Percentile value (0-100) */
  percentile: number;
  
  /** Previous percentile for trend comparison */
  previousPercentile?: number;
  
  /** Custom description for the rank */
  description?: string;
}

export const RankWidgetVariant: React.FC<RankWidgetVariantProps> = ({
  variant,
  percentile,
  previousPercentile,
  description,
  ...props
}) => {
  // Define variant configurations
  const getVariantConfig = (): Partial<RankData> => {
    switch (variant) {
      case 'performance':
        return {
          description: description || 'vs peers',
        };
      case 'satisfaction':
        return {
          description: description || 'satisfaction score',
        };
      case 'engagement':
        return {
          description: description || 'engagement level',
        };
      case 'compliance':
        return {
          description: description || 'compliance rating',
        };
      case 'custom':
      default:
        return {
          description: description || 'percentile ranking',
        };
    }
  };

  const config = getVariantConfig();
  const rankData: RankData = {
    percentile,
    previousPercentile,
    ...config,
  };

  return <RankWidget rank={rankData} {...props} />;
};

export default RankWidget;