import type { Theme } from '@mui/material/styles';

/**
 * Get theme-aware feedback colors for consistent success/error/warning states
 */
export const getFeedbackColors = (theme: Theme, themeMode: 'hyundai' | 'unfiltered') => {
  const base = {
    success: theme.palette.success.main,
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
    info: theme.palette.info.main,
  };

  // For Unfiltered theme, we want to use the bright yellow for primary actions
  // but keep green for actual success states
  if (themeMode === 'unfiltered') {
    return {
      ...base,
      primary: '#F6FA24', // Bright yellow for primary actions
      primaryHover: '#FFD700', // Gold for hover
      primaryLight: '#FFFB5A', // Light yellow
      primaryDark: '#C7CC00', // Dark yellow-green
    };
  }

  // For Hyundai theme, use the standard Material-UI colors
  return {
    ...base,
    primary: theme.palette.primary.main,
    primaryHover: theme.palette.primary.dark,
    primaryLight: theme.palette.primary.light,
    primaryDark: theme.palette.primary.dark,
  };
};

/**
 * Get button colors based on theme and state
 */
export const getButtonColors = (theme: Theme, themeMode: 'hyundai' | 'unfiltered', selected: boolean = false) => {
  const colors = getFeedbackColors(theme, themeMode);
  
  if (themeMode === 'unfiltered') {
    return {
      backgroundColor: selected ? colors.primary : 'transparent',
      color: selected ? '#000000' : theme.palette.text.primary,
      borderColor: selected ? colors.primary : theme.palette.divider,
      '&:hover': {
        backgroundColor: selected ? colors.primaryHover : 'rgba(246, 250, 36, 0.1)',
        borderColor: colors.primary,
      },
      '&.selected': {
        backgroundColor: colors.primary,
        color: '#000000',
        borderColor: colors.primary,
      },
    };
  }
  
  // Standard Material-UI button styling for Hyundai theme
  return {
    backgroundColor: selected ? theme.palette.primary.main : 'transparent',
    color: selected ? theme.palette.primary.contrastText : theme.palette.text.primary,
    borderColor: selected ? theme.palette.primary.main : theme.palette.divider,
    '&:hover': {
      backgroundColor: selected ? theme.palette.primary.dark : theme.palette.action.hover,
      borderColor: theme.palette.primary.main,
    },
    '&.selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      borderColor: theme.palette.primary.main,
    },
  };
};

/**
 * Get line colors for matching questions
 */
export const getLineColors = (theme: Theme) => {
  return {
    default: theme.palette.info.main,
    correct: theme.palette.success.main,
    incorrect: theme.palette.error.main,
  };
};

/**
 * Get star rating colors
 */
export const getStarColors = (theme: Theme, themeMode: 'hyundai' | 'unfiltered') => {
  const colors = getFeedbackColors(theme, themeMode);
  
  if (themeMode === 'unfiltered') {
    return {
      filled: colors.primary,
      empty: '#333333',
      hover: colors.primaryHover,
    };
  }
  
  return {
    filled: theme.palette.warning.main,
    empty: theme.palette.action.disabled,
    hover: theme.palette.warning.light,
  };
};