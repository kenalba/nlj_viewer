import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    unfiltered: {
      brightYellow: string;
      backgroundBlack: string;
      cardBorder: string;
      gradient: string;
      textSecondary: string;
    };
  }
  
  interface PaletteOptions {
    unfiltered?: {
      brightYellow?: string;
      backgroundBlack?: string;
      cardBorder?: string;
      gradient?: string;
      textSecondary?: string;
    };
  }
}

export const unfilteredTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F6FA24', // Bright Yellow
      light: '#FFFB5A',
      dark: '#C7CC00',
      contrastText: '#000000',
    },
    secondary: {
      main: '#FFFFFF',
      light: '#FFFFFF',
      dark: '#CCCCCC',
      contrastText: '#000000',
    },
    background: {
      default: '#141414', // Background Black
      paper: '#1A1A1A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#CCCCCC',
    },
    error: {
      main: '#FF6B6B',
      light: '#FF9999',
      dark: '#CC5555',
    },
    warning: {
      main: '#FFB800',
      light: '#FFD54F',
      dark: '#CC9200',
    },
    success: {
      main: '#4CAF50',
      light: '#81C784',
      dark: '#388E3C',
    },
    unfiltered: {
      brightYellow: '#F6FA24',
      backgroundBlack: '#141414',
      cardBorder: '#333333',
      gradient: 'linear-gradient(135deg, #F6FA24 0%, #FFD700 100%)',
      textSecondary: '#CCCCCC',
    },
  },
  typography: {
    fontFamily: [
      'SF Pro Text',
      'Saint Regus',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      color: '#FFFFFF',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
      color: '#FFFFFF',
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#FFFFFF',
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#FFFFFF',
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#FFFFFF',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#FFFFFF',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#FFFFFF',
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#CCCCCC',
      fontWeight: 400,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      fontSize: '0.875rem',
      letterSpacing: '0.02em',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      color: '#CCCCCC',
      fontWeight: 400,
    },
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          width: '100%',
          height: '100%',
          backgroundColor: '#141414',
        },
        body: {
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          backgroundColor: '#141414',
          color: '#FFFFFF',
        },
        '#root': {
          width: '100%',
          height: '100%',
          backgroundColor: '#141414',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 24,
          padding: '12px 24px',
          fontSize: '0.875rem',
          boxShadow: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(246, 250, 36, 0.3)',
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #F6FA24 0%, #FFD700 100%)',
          color: '#000000',
          border: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, #FFD700 0%, #F6FA24 100%)',
            boxShadow: '0 6px 20px rgba(246, 250, 36, 0.4)',
          },
          '&:active': {
            transform: 'translateY(0px)',
          },
          '&.Mui-disabled': {
            background: '#333333',
            color: '#888888',
            opacity: 0.6,
          },
        },
        outlined: {
          borderColor: '#F6FA24',
          color: '#F6FA24',
          backgroundColor: 'transparent',
          '&:hover': {
            borderColor: '#FFD700',
            backgroundColor: 'rgba(246, 250, 36, 0.1)',
            color: '#FFD700',
          },
          '&.selected': {
            borderColor: '#F6FA24',
            backgroundColor: '#F6FA24',
            color: '#000000',
            '&:hover': {
              borderColor: '#FFD700',
              backgroundColor: '#FFD700',
              color: '#000000',
            },
          },
        },
        text: {
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: 'rgba(246, 250, 36, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          backgroundColor: '#1A1A1A',
          border: '1px solid #333333',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            transform: 'translateY(-2px)',
            borderColor: '#F6FA24',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1A1A',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          color: '#FFFFFF',
          borderBottom: '1px solid #333333',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
        },
        bar: {
          background: 'linear-gradient(90deg, #F6FA24 0%, #FFD700 100%)',
          borderRadius: 3,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          color: '#81C784',
          border: '1px solid #4CAF50',
        },
        standardError: {
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          color: '#FF9999',
          border: '1px solid #FF6B6B',
        },
        standardInfo: {
          backgroundColor: 'rgba(246, 250, 36, 0.1)',
          color: '#F6FA24',
          border: '1px solid #F6FA24',
        },
        standardWarning: {
          backgroundColor: 'rgba(255, 184, 0, 0.1)',
          color: '#FFD54F',
          border: '1px solid #FFB800',
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: '#CCCCCC',
          '&.Mui-checked': {
            color: '#F6FA24',
          },
          '&:hover': {
            backgroundColor: 'rgba(246, 250, 36, 0.1)',
          },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          marginBottom: 12,
          '& .MuiFormControlLabel-label': {
            fontSize: '0.95rem',
            lineHeight: 1.5,
            color: '#FFFFFF',
          },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          '&::after': {
            background: 'linear-gradient(90deg, transparent, rgba(246, 250, 36, 0.1), transparent)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          color: '#FFFFFF',
          borderRadius: 16,
          '&:hover': {
            backgroundColor: 'rgba(246, 250, 36, 0.1)',
          },
        },
        filled: {
          backgroundColor: '#F6FA24',
          color: '#000000',
          '&:hover': {
            backgroundColor: '#FFD700',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#FFFFFF',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: 'rgba(246, 250, 36, 0.1)',
            color: '#F6FA24',
            transform: 'scale(1.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1A1A',
          color: '#FFFFFF',
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 8,
          '& .MuiSlider-rail': {
            color: '#333333',
            opacity: 1,
            height: 8,
          },
          '& .MuiSlider-track': {
            border: 'none',
            height: 8,
            backgroundColor: '#F6FA24',
          },
          '& .MuiSlider-thumb': {
            height: 24,
            width: 24,
            backgroundColor: '#F6FA24',
            border: '2px solid currentColor',
            '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
              boxShadow: '0px 0px 0px 8px rgba(246, 250, 36, 0.16)',
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
            backgroundColor: '#F6FA24',
            color: '#000000',
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
            backgroundColor: '#666666',
            height: 8,
            width: 1,
            '&.MuiSlider-markActive': {
              opacity: 1,
              backgroundColor: 'currentColor',
            },
          },
          '& .MuiSlider-markLabel': {
            color: '#CCCCCC',
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