import { createTheme, alpha } from '@mui/material/styles';

// Hyundai Brand Design Tokens
const hyundaiDesignTokens = {
  // Official Hyundai Brand Colors
  colors: {
    hyundaiBlue: '#0066CC', // Official Hyundai Corporate Blue
    hyundaiDarkBlue: '#004C99',
    hyundaiLightBlue: '#3385D6',
    hyundaiSilver: '#C0C0C0',
    hyundaiDarkSilver: '#999999',
    hyundaiLightSilver: '#E0E0E0',
    hyundaiBlack: '#1A1A1A',
    hyundaiDarkGray: '#404040',
    hyundaiMediumGray: '#666666',
    hyundaiLightGray: '#F8F8F8',
    hyundaiWhite: '#FFFFFF',
  },
  // Typography Scale
  typography: {
    fontFamily: [
      'Poppins',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    fontWeights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  // Spacing and Layout
  spacing: {
    baseUnit: 8,
    borderRadius: {
      small: 4,
      medium: 8,
      large: 12,
      xlarge: 16,
    },
  },
  // Shadows
  shadows: {
    card: '0 2px 12px rgba(26, 26, 26, 0.08)',
    cardHover: '0 4px 20px rgba(26, 26, 26, 0.12)',
    button: '0 2px 8px rgba(26, 26, 26, 0.15)',
    appBar: '0 2px 8px rgba(26, 26, 26, 0.2)',
  },
};

// Theme Module Augmentation
declare module '@mui/material/styles' {
  interface Palette {
    hyundai: {
      primary: string;
      primaryLight: string;
      primaryDark: string;
      secondary: string;
      secondaryLight: string;
      secondaryDark: string;
      accent: string;
      accentLight: string;
      neutral: {
        900: string;
        800: string;
        600: string;
        400: string;
        200: string;
        100: string;
        50: string;
      };
    };
  }
  
  interface PaletteOptions {
    hyundai?: {
      primary?: string;
      primaryLight?: string;
      primaryDark?: string;
      secondary?: string;
      secondaryLight?: string;
      secondaryDark?: string;
      accent?: string;
      accentLight?: string;
      neutral?: {
        900?: string;
        800?: string;
        600?: string;
        400?: string;
        200?: string;
        100?: string;
        50?: string;
      };
    };
  }

  interface Theme {
    hyundaiTokens: typeof hyundaiDesignTokens;
  }

  interface ThemeOptions {
    hyundaiTokens?: typeof hyundaiDesignTokens;
  }
}

export const hyundaiTheme = createTheme({
  hyundaiTokens: hyundaiDesignTokens,
  palette: {
    mode: 'light',
    primary: {
      main: hyundaiDesignTokens.colors.hyundaiBlue,
      light: hyundaiDesignTokens.colors.hyundaiLightBlue,
      dark: hyundaiDesignTokens.colors.hyundaiDarkBlue,
      contrastText: hyundaiDesignTokens.colors.hyundaiWhite,
    },
    secondary: {
      main: hyundaiDesignTokens.colors.hyundaiBlack,
      light: hyundaiDesignTokens.colors.hyundaiDarkGray,
      dark: '#000000',
      contrastText: hyundaiDesignTokens.colors.hyundaiWhite,
    },
    background: {
      default: hyundaiDesignTokens.colors.hyundaiWhite,
      paper: hyundaiDesignTokens.colors.hyundaiLightGray,
    },
    text: {
      primary: hyundaiDesignTokens.colors.hyundaiBlack,
      secondary: hyundaiDesignTokens.colors.hyundaiMediumGray,
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#C62828',
    },
    warning: {
      main: '#FFC107',
      light: '#FFD54F',
      dark: '#F57C00',
    },
    success: {
      main: '#388E3C',
      light: '#4CAF50',
      dark: '#2E7D32',
    },
    info: {
      main: hyundaiDesignTokens.colors.hyundaiBlue,
      light: hyundaiDesignTokens.colors.hyundaiLightBlue,
      dark: hyundaiDesignTokens.colors.hyundaiDarkBlue,
    },
    hyundai: {
      primary: hyundaiDesignTokens.colors.hyundaiBlue,
      primaryLight: hyundaiDesignTokens.colors.hyundaiLightBlue,
      primaryDark: hyundaiDesignTokens.colors.hyundaiDarkBlue,
      secondary: hyundaiDesignTokens.colors.hyundaiBlack,
      secondaryLight: hyundaiDesignTokens.colors.hyundaiDarkGray,
      secondaryDark: '#000000',
      accent: hyundaiDesignTokens.colors.hyundaiSilver,
      accentLight: hyundaiDesignTokens.colors.hyundaiLightSilver,
      neutral: {
        900: hyundaiDesignTokens.colors.hyundaiBlack,
        800: hyundaiDesignTokens.colors.hyundaiDarkGray,
        600: hyundaiDesignTokens.colors.hyundaiMediumGray,
        400: hyundaiDesignTokens.colors.hyundaiSilver,
        200: hyundaiDesignTokens.colors.hyundaiLightSilver,
        100: hyundaiDesignTokens.colors.hyundaiLightGray,
        50: hyundaiDesignTokens.colors.hyundaiWhite,
      },
    },
  },
  typography: {
    fontFamily: hyundaiDesignTokens.typography.fontFamily,
    h1: {
      fontSize: 'clamp(2rem, 4vw, 2.75rem)', // Responsive scaling
      fontWeight: hyundaiDesignTokens.typography.fontWeights.bold,
      lineHeight: 1.2,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.bold,
      lineHeight: 1.25,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: 'clamp(1.5rem, 3vw, 2rem)',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
      lineHeight: 1.3,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
    },
    h4: {
      fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
      lineHeight: 1.35,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
    },
    h5: {
      fontSize: 'clamp(1.125rem, 2vw, 1.5rem)',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
      lineHeight: 1.4,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
    },
    h6: {
      fontSize: 'clamp(1rem, 1.5vw, 1.25rem)',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
      lineHeight: 1.4,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.6,
      color: hyundaiDesignTokens.colors.hyundaiBlack,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.6,
      color: hyundaiDesignTokens.colors.hyundaiMediumGray,
    },
    button: {
      fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
      textTransform: 'none',
      fontSize: '0.875rem',
      letterSpacing: '0.01em',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.5,
      color: hyundaiDesignTokens.colors.hyundaiMediumGray,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
      lineHeight: 1.5,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: hyundaiDesignTokens.colors.hyundaiMediumGray,
    },
  },
  shape: {
    borderRadius: hyundaiDesignTokens.spacing.borderRadius.medium,
  },
  spacing: hyundaiDesignTokens.spacing.baseUnit,
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        html {
          width: 100%;
          height: 100%;
        }
        
        body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          font-family: ${hyundaiDesignTokens.typography.fontFamily};
        }
        
        #root {
          width: 100%;
          height: 100%;
        }
        
        * {
          box-sizing: border-box;
        }
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: hyundaiDesignTokens.typography.fontWeights.semibold,
          borderRadius: hyundaiDesignTokens.spacing.borderRadius.medium,
          padding: '12px 24px',
          fontSize: '0.875rem',
          letterSpacing: '0.01em',
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: hyundaiDesignTokens.shadows.button,
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
          color: hyundaiDesignTokens.colors.hyundaiWhite,
          '&:hover': {
            backgroundColor: hyundaiDesignTokens.colors.hyundaiDarkBlue,
          },
          '&:disabled': {
            backgroundColor: hyundaiDesignTokens.colors.hyundaiLightSilver,
            color: hyundaiDesignTokens.colors.hyundaiMediumGray,
          },
        },
        outlined: {
          borderColor: hyundaiDesignTokens.colors.hyundaiSilver,
          color: hyundaiDesignTokens.colors.hyundaiBlack,
          borderWidth: '1.5px',
          '&:hover': {
            borderColor: hyundaiDesignTokens.colors.hyundaiBlue,
            backgroundColor: alpha(hyundaiDesignTokens.colors.hyundaiBlue, 0.04),
            borderWidth: '1.5px',
          },
          '&.selected': {
            borderColor: hyundaiDesignTokens.colors.hyundaiBlue,
            backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
            color: hyundaiDesignTokens.colors.hyundaiWhite,
            '&:hover': {
              borderColor: hyundaiDesignTokens.colors.hyundaiDarkBlue,
              backgroundColor: hyundaiDesignTokens.colors.hyundaiDarkBlue,
            },
          },
        },
        text: {
          color: hyundaiDesignTokens.colors.hyundaiBlue,
          '&:hover': {
            backgroundColor: alpha(hyundaiDesignTokens.colors.hyundaiBlue, 0.04),
          },
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'secondary' },
          style: {
            backgroundColor: hyundaiDesignTokens.colors.hyundaiBlack,
            color: hyundaiDesignTokens.colors.hyundaiWhite,
            '&:hover': {
              backgroundColor: hyundaiDesignTokens.colors.hyundaiDarkGray,
            },
          },
        },
        {
          props: { variant: 'hyundai' } as any,
          style: {
            backgroundColor: hyundaiDesignTokens.colors.hyundaiSilver,
            color: hyundaiDesignTokens.colors.hyundaiBlack,
            border: `1.5px solid ${hyundaiDesignTokens.colors.hyundaiSilver}`,
            '&:hover': {
              backgroundColor: hyundaiDesignTokens.colors.hyundaiDarkSilver,
              borderColor: hyundaiDesignTokens.colors.hyundaiDarkSilver,
            },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: hyundaiDesignTokens.spacing.borderRadius.large,
          boxShadow: hyundaiDesignTokens.shadows.card,
          border: `1px solid ${hyundaiDesignTokens.colors.hyundaiLightSilver}`,
          backgroundColor: hyundaiDesignTokens.colors.hyundaiWhite,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: hyundaiDesignTokens.shadows.cardHover,
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
          boxShadow: hyundaiDesignTokens.shadows.appBar,
          color: hyundaiDesignTokens.colors.hyundaiWhite,
          '&.MuiAppBar-colorInherit': {
            backgroundColor: hyundaiDesignTokens.colors.hyundaiWhite,
            color: hyundaiDesignTokens.colors.hyundaiBlack,
            boxShadow: `0 1px 3px ${alpha(hyundaiDesignTokens.colors.hyundaiBlack, 0.12)}`,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: hyundaiDesignTokens.colors.hyundaiLightSilver,
          height: 6,
          borderRadius: hyundaiDesignTokens.spacing.borderRadius.small,
        },
        bar: {
          backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
          borderRadius: hyundaiDesignTokens.spacing.borderRadius.small,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: hyundaiDesignTokens.spacing.borderRadius.medium,
          fontWeight: hyundaiDesignTokens.typography.fontWeights.medium,
        },
        standardSuccess: {
          backgroundColor: '#E8F5E8',
          color: '#2E7D32',
          border: '1px solid #4CAF50',
        },
        standardError: {
          backgroundColor: '#FFEBEE',
          color: '#C62828',
          border: '1px solid #F44336',
        },
        standardInfo: {
          backgroundColor: alpha(hyundaiDesignTokens.colors.hyundaiBlue, 0.08),
          color: hyundaiDesignTokens.colors.hyundaiBlack,
          border: `1px solid ${hyundaiDesignTokens.colors.hyundaiBlue}`,
        },
        standardWarning: {
          backgroundColor: '#FFF8E1',
          color: '#E65100',
          border: '1px solid #FF9800',
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: hyundaiDesignTokens.colors.hyundaiMediumGray,
          '&.Mui-checked': {
            color: hyundaiDesignTokens.colors.hyundaiBlue,
          },
          '&:hover': {
            backgroundColor: alpha(hyundaiDesignTokens.colors.hyundaiBlue, 0.04),
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: hyundaiDesignTokens.colors.hyundaiMediumGray,
          '&.Mui-checked': {
            color: hyundaiDesignTokens.colors.hyundaiBlue,
          },
          '&:hover': {
            backgroundColor: alpha(hyundaiDesignTokens.colors.hyundaiBlue, 0.04),
          },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          marginBottom: 8,
          '& .MuiFormControlLabel-label': {
            fontSize: '0.95rem',
            lineHeight: 1.5,
          },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: hyundaiDesignTokens.colors.hyundaiLightGray,
          borderRadius: hyundaiDesignTokens.spacing.borderRadius.small,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: hyundaiDesignTokens.spacing.borderRadius.medium,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: hyundaiDesignTokens.colors.hyundaiBlue,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: hyundaiDesignTokens.colors.hyundaiBlue,
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root': {
            color: hyundaiDesignTokens.colors.hyundaiMediumGray,
            '&.Mui-focused': {
              color: hyundaiDesignTokens.colors.hyundaiBlue,
            },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 8,
          '& .MuiSlider-rail': {
            color: hyundaiDesignTokens.colors.hyundaiLightSilver,
            opacity: 1,
            height: 8,
            borderRadius: hyundaiDesignTokens.spacing.borderRadius.small,
          },
          '& .MuiSlider-track': {
            border: 'none',
            height: 8,
            backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
            borderRadius: hyundaiDesignTokens.spacing.borderRadius.small,
          },
          '& .MuiSlider-thumb': {
            height: 24,
            width: 24,
            backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
            border: '2px solid currentColor',
            '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
              boxShadow: `0px 0px 0px 8px ${alpha(hyundaiDesignTokens.colors.hyundaiBlue, 0.16)}`,
            },
            '&:before': {
              display: 'none',
            },
          },
          '& .MuiSlider-valueLabel': {
            lineHeight: 1.2,
            fontSize: 12,
            background: 'unset',
            padding: 0,
            width: 32,
            height: 32,
            borderRadius: '50% 50% 50% 0',
            backgroundColor: hyundaiDesignTokens.colors.hyundaiBlue,
            color: hyundaiDesignTokens.colors.hyundaiWhite,
            transformOrigin: 'bottom left',
            transform: 'translate(50%, -100%) rotate(-45deg) scale(0)',
            '&:before': { display: 'none' },
            '&.MuiSlider-valueLabelOpen': {
              transform: 'translate(50%, -100%) rotate(-45deg) scale(1)',
            },
            '& > *': {
              transform: 'rotate(45deg)',
            },
          },
          '& .MuiSlider-mark': {
            backgroundColor: hyundaiDesignTokens.colors.hyundaiSilver,
            height: 8,
            width: 1,
            '&.MuiSlider-markActive': {
              opacity: 1,
              backgroundColor: 'currentColor',
            },
          },
          '& .MuiSlider-markLabel': {
            color: hyundaiDesignTokens.colors.hyundaiMediumGray,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingTop: '8px',
            paddingBottom: '8px',
          },
        },
      },
    },
  },
});