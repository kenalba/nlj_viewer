import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    hyundai: {
      primary: string;
      secondary: string;
      accent: string;
      dark: string;
      light: string;
    };
  }
  
  interface PaletteOptions {
    hyundai?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      dark?: string;
      light?: string;
    };
  }
}

export const hyundaiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1A1A1A', // Black
      light: '#404040',
      dark: '#000000',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#C0C0C0', // Silver
      light: '#E0E0E0',
      dark: '#999999',
      contrastText: '#1A1A1A',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F8F8F8',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#666666',
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
      main: '#0078D4',
      light: '#42A5F5',
      dark: '#1976D2',
    },
    hyundai: {
      primary: '#1A1A1A',
      secondary: '#C0C0C0',
      accent: '#0078D4',
      dark: '#000000',
      light: '#F8F8F8',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
      color: '#1A1A1A',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#1A1A1A',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#1A1A1A',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#1A1A1A',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#1A1A1A',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#1A1A1A',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#1A1A1A',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#666666',
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      fontSize: '0.875rem',
    },
  },
  shape: {
    borderRadius: 2,
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          width: '100%',
          height: '100%',
        },
        body: {
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
        },
        '#root': {
          width: '100%',
          height: '100%',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '0.875rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(26, 26, 26, 0.15)',
          },
        },
        contained: {
          backgroundColor: '#1A1A1A',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: '#404040',
          },
        },
        outlined: {
          borderColor: '#C0C0C0',
          color: '#1A1A1A',
          '&:hover': {
            borderColor: '#0078D4',
            backgroundColor: '#F8F8F8',
          },
          '&.selected': {
            borderColor: '#0078D4',
            backgroundColor: '#0078D4',
            color: '#FFFFFF',
            '&:hover': {
              borderColor: '#005A9F',
              backgroundColor: '#005A9F',
              color: '#FFFFFF',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(26, 26, 26, 0.08)',
          border: '1px solid #E0E0E0',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(26, 26, 26, 0.12)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1A1A1A',
          boxShadow: '0 2px 8px rgba(26, 26, 26, 0.2)',
          color: '#FFFFFF',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#E0E0E0',
          height: 4,
        },
        bar: {
          backgroundColor: '#0078D4',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
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
          backgroundColor: '#F0F8FF',
          color: '#1A1A1A',
          border: '1px solid #0078D4',
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: '#666666',
          '&.Mui-checked': {
            color: '#0078D4',
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
          backgroundColor: '#F8F8F8',
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 8,
          '& .MuiSlider-rail': {
            color: '#d0d0d0',
            opacity: 1,
            height: 8,
          },
          '& .MuiSlider-track': {
            border: 'none',
            height: 8,
            backgroundColor: '#0078D4',
          },
          '& .MuiSlider-thumb': {
            height: 24,
            width: 24,
            backgroundColor: '#0078D4',
            border: '2px solid currentColor',
            '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
              boxShadow: '0px 0px 0px 8px rgba(0, 120, 212, 0.16)',
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
            backgroundColor: '#0078D4',
            color: '#ffffff',
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
            backgroundColor: '#bfbfbf',
            height: 8,
            width: 1,
            '&.MuiSlider-markActive': {
              opacity: 1,
              backgroundColor: 'currentColor',
            },
          },
          '& .MuiSlider-markLabel': {
            color: '#666666',
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