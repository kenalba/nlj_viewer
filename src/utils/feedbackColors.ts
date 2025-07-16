import type { Theme } from '@mui/material/styles';

/**
 * Get theme-aware feedback colors for consistent success/error/warning states
 * 
 * IMPORTANT: Semantic feedback colors (success, error, warning, info) should remain
 * consistent across themes to maintain clear meaning. Only primary/accent colors
 * should change based on theme.
 */
export const getFeedbackColors = (theme: Theme, themeMode: 'hyundai' | 'unfiltered') => {
  // Semantic feedback colors - consistent across all themes
  const semantic = {
    success: theme.palette.success.main,     // Always green
    error: theme.palette.error.main,         // Always red  
    warning: theme.palette.warning.main,     // Always orange/amber
    info: theme.palette.info.main,           // Always blue
  };

  // Theme-specific primary/accent colors for non-semantic elements
  if (themeMode === 'unfiltered') {
    return {
      ...semantic,
      primary: '#F6FA24',        // Bright yellow for primary actions
      primaryHover: '#FFD700',   // Gold for hover
      primaryLight: '#FFFB5A',   // Light yellow
      primaryDark: '#C7CC00',    // Dark yellow-green
    };
  }

  // For Hyundai theme, use the standard Material-UI colors
  return {
    ...semantic,
    primary: theme.palette.primary.main,
    primaryHover: theme.palette.primary.dark,
    primaryLight: theme.palette.primary.light,
    primaryDark: theme.palette.primary.dark,
  };
};

/**
 * Get Alert feedback colors that respect semantic meaning
 * while allowing theme-specific styling for non-semantic elements
 */
export const getAlertFeedbackColors = (theme: Theme, themeMode: 'hyundai' | 'unfiltered', severity: 'success' | 'error' | 'warning' | 'info') => {
  const colors = getFeedbackColors(theme, themeMode);
  
  // For semantic feedback, always use the appropriate semantic color
  const iconColor = colors[severity];
  
  // Theme-specific background styling
  const backgroundStyle = themeMode === 'unfiltered' 
    ? {
        backgroundColor: 'rgba(246, 250, 36, 0.1)',
        border: '1px solid rgba(246, 250, 36, 0.3)',
      }
    : {};

  return {
    iconColor,
    backgroundStyle,
    borderRadius: themeMode === 'unfiltered' ? 16 : 2,
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