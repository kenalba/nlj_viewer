/**
 * Survey Analytics Utilities
 * Functions for getting theme-aware colors for survey data visualization
 * Works with existing Genesis, Hyundai, and other MUI themes
 */

import { Theme, useTheme } from '@mui/material/styles';

/**
 * Get response colors based on question scale type
 * Uses standard MUI theme colors that work across Genesis, Hyundai, etc.
 */
export const getResponseColors = (
  theme: Theme,
  scale: 'likert' | 'nps' | 'binary' | 'custom',
  valueCount: number = 3
): string[] => {
  switch (scale) {
    case 'likert':
      if (valueCount === 5) {
        // 5-point Likert: Strongly Disagree → Strongly Agree
        return [
          theme.palette.error.main,      // Strongly Disagree (red)
          theme.palette.error.light,     // Disagree (light red)
          theme.palette.grey[400],       // Neutral (gray)
          theme.palette.success.light,   // Agree (light green)
          theme.palette.success.main,    // Strongly Agree (green)
        ];
      } else if (valueCount === 3) {
        // 3-point scale: Negative → Positive
        return [
          theme.palette.error.main,      // Negative
          theme.palette.grey[400],       // Passive/Neutral
          theme.palette.success.main,    // Positive
        ];
      }
      break;
    case 'nps':
      // NPS scale: Detractors (0-6), Passives (7-8), Promoters (9-10)
      return [
        theme.palette.error.main,        // Detractors
        theme.palette.grey[400],         // Passives
        theme.palette.success.main,      // Promoters
      ];
    case 'binary':
      // Yes/No, True/False
      return [
        theme.palette.error.main,        // No/False
        theme.palette.success.main,      // Yes/True
      ];
    default:
      // Default 3-color scheme for unknown scales
      return [
        theme.palette.error.main,
        theme.palette.grey[400],
        theme.palette.success.main,
      ];
  }
  
  // Fallback to 3-color scheme
  return [
    theme.palette.error.main,
    theme.palette.grey[400],
    theme.palette.success.main,
  ];
};

/**
 * Get ranking color based on percentile performance
 */
export const getRankingColor = (theme: Theme, percentile: number): string => {
  if (percentile >= 90) return theme.palette.success.main;      // Top 10%
  if (percentile >= 61) return theme.palette.info.main;        // Above Average
  if (percentile >= 41) return theme.palette.grey[500];        // Average
  if (percentile >= 11) return theme.palette.warning.main;     // Below Average
  return theme.palette.error.main;                             // Bottom 10%
};

/**
 * Get trending color based on percentage change
 */
export const getTrendingColor = (theme: Theme, changePercent: number): string => {
  if (changePercent > 25) return theme.palette.primary.main;    // Skyrocketing
  if (changePercent > 6) return theme.palette.info.main;       // Trending Up
  if (changePercent >= -5) return theme.palette.grey[500];     // Steady
  if (changePercent >= -24) return theme.palette.warning.main; // Trending Down
  return theme.palette.error.main;                             // Plummeting
};

/**
 * Get demographic group colors for charts
 */
export const getDemographicColors = (theme: Theme, groupCount: number): string[] => {
  const baseColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
  ];
  
  // Return appropriate number of colors, cycling if needed
  const colors: string[] = [];
  for (let i = 0; i < groupCount; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
};

/**
 * Get anonymized placeholder color for small sample sizes
 */
export const getAnonymizedColor = (theme: Theme): string => {
  return theme.palette.grey[300];
};

/**
 * Hook to get survey colors using current theme
 */
export const useSurveyColors = () => {
  const theme = useTheme();
  
  return {
    getResponseColors: (scale: 'likert' | 'nps' | 'binary' | 'custom', valueCount?: number) =>
      getResponseColors(theme, scale, valueCount),
    getRankingColor: (percentile: number) => getRankingColor(theme, percentile),
    getTrendingColor: (changePercent: number) => getTrendingColor(theme, changePercent),
    getDemographicColors: (groupCount: number) => getDemographicColors(theme, groupCount),
    getAnonymizedColor: () => getAnonymizedColor(theme),
  };
};