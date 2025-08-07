import { createTheme, alpha } from '@mui/material/styles';

// Genesis Brand Design Tokens
const genesisDesignTokens = {
  // Official Genesis Brand Colors
  colors: {
    // Core Palette
    genesisBlack: '#000000',
    genesisCarbonDark: '#1A1A1A', // Carbon color from brand guide
    genesisCarbon: '#404040', // Lighter carbon for UI use
    genesisCopper: '#C36F51', // Copper - used sparingly
    genesisGray: '#AAA8A6', // Primary gray
    genesisMediumGray: '#999999',
    genesisLightGray: '#E0E0E0',
    genesisWhite: '#FFFFFF',
    
    // Auxiliary Palette (Digital Only)
    genesisLime: '#30A878',
    genesisLimeDark: '#34BA85',
    genesisBlue: '#1D8ABC',
    genesisBlueDark: '#1D8ABC', 
    genesisYellow: '#DB9200',
    genesisYellowDark: '#F2A200',
    genesisRed: '#CE2D2D',
    genesisRedDark: '#D83636',
  },
  // Typography - Genesis Sans family
  typography: {
    fontFamily: [
      'Genesis Sans',
      'Poppins', // Fallback similar to Genesis Sans
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
  // Shadows - refined and subtle for dark mode
  shadows: {
    card: '0 2px 12px rgba(0, 0, 0, 0.5)',
    cardHover: '0 4px 20px rgba(0, 0, 0, 0.7)',
    button: '0 2px 8px rgba(0, 0, 0, 0.4)',
    appBar: '0 2px 8px rgba(0, 0, 0, 0.6)',
  },
};

// Theme Module Augmentation
declare module '@mui/material/styles' {
  interface Palette {
    genesis: {
      primary: string;
      primaryLight: string;
      secondary: string;
      secondaryLight: string;
      copper: string;
      copperLight: string;
      auxiliary: {
        lime: string;
        limeDark: string;
        blue: string;
        blueDark: string;
        yellow: string;
        yellowDark: string;
        red: string;
        redDark: string;
      };
      neutral: {
        900: string;
        800: string;
        700: string;
        600: string;
        400: string;
        200: string;
        100: string;
        50: string;
      };
    };
  }
  
  interface PaletteOptions {
    genesis?: {
      primary?: string;
      primaryLight?: string;
      secondary?: string;
      secondaryLight?: string;
      copper?: string;
      copperLight?: string;
      auxiliary?: {
        lime?: string;
        limeDark?: string;
        blue?: string;
        blueDark?: string;
        yellow?: string;
        yellowDark?: string;
        red?: string;
        redDark?: string;
      };
      neutral?: {
        900?: string;
        800?: string;
        700?: string;
        600?: string;
        400?: string;
        200?: string;
        100?: string;
        50?: string;
      };
    };
  }

  interface Theme {
    genesisTokens: typeof genesisDesignTokens;
  }

  interface ThemeOptions {
    genesisTokens?: typeof genesisDesignTokens;
  }
}

export const genesisTheme = createTheme({
  genesisTokens: genesisDesignTokens,
  palette: {
    mode: 'dark', // Changed to dark mode
    primary: {
      main: genesisDesignTokens.colors.genesisWhite,
      light: genesisDesignTokens.colors.genesisLightGray,
      dark: genesisDesignTokens.colors.genesisGray,
      contrastText: genesisDesignTokens.colors.genesisBlack,
    },
    secondary: {
      main: genesisDesignTokens.colors.genesisCopper,
      light: alpha(genesisDesignTokens.colors.genesisCopper, 0.7),
      dark: '#A65B45',
      contrastText: genesisDesignTokens.colors.genesisWhite,
    },
    background: {
      default: genesisDesignTokens.colors.genesisBlack,
      paper: genesisDesignTokens.colors.genesisCarbonDark,
    },
    text: {
      primary: genesisDesignTokens.colors.genesisWhite,
      secondary: genesisDesignTokens.colors.genesisGray,
    },
    error: {
      main: genesisDesignTokens.colors.genesisRedDark,
      light: alpha(genesisDesignTokens.colors.genesisRedDark, 0.7),
      dark: genesisDesignTokens.colors.genesisRed,
    },
    warning: {
      main: genesisDesignTokens.colors.genesisYellowDark,
      light: alpha(genesisDesignTokens.colors.genesisYellowDark, 0.7),
      dark: genesisDesignTokens.colors.genesisYellow,
    },
    success: {
      main: genesisDesignTokens.colors.genesisLimeDark,
      light: alpha(genesisDesignTokens.colors.genesisLimeDark, 0.7),
      dark: genesisDesignTokens.colors.genesisLime,
    },
    info: {
      main: genesisDesignTokens.colors.genesisBlue,
      light: alpha(genesisDesignTokens.colors.genesisBlue, 0.7),
      dark: genesisDesignTokens.colors.genesisBlueDark,
    },
    divider: alpha(genesisDesignTokens.colors.genesisGray, 0.3),
    genesis: {
      primary: genesisDesignTokens.colors.genesisWhite,
      primaryLight: genesisDesignTokens.colors.genesisLightGray,
      secondary: genesisDesignTokens.colors.genesisGray,
      secondaryLight: genesisDesignTokens.colors.genesisMediumGray,
      copper: genesisDesignTokens.colors.genesisCopper,
      copperLight: alpha(genesisDesignTokens.colors.genesisCopper, 0.5),
      auxiliary: {
        lime: genesisDesignTokens.colors.genesisLime,
        limeDark: genesisDesignTokens.colors.genesisLimeDark,
        blue: genesisDesignTokens.colors.genesisBlue,
        blueDark: genesisDesignTokens.colors.genesisBlueDark,
        yellow: genesisDesignTokens.colors.genesisYellow,
        yellowDark: genesisDesignTokens.colors.genesisYellowDark,
        red: genesisDesignTokens.colors.genesisRed,
        redDark: genesisDesignTokens.colors.genesisRedDark,
      },
      neutral: {
        900: genesisDesignTokens.colors.genesisBlack,
        800: genesisDesignTokens.colors.genesisCarbonDark,
        700: genesisDesignTokens.colors.genesisCarbon,
        600: genesisDesignTokens.colors.genesisMediumGray,
        400: genesisDesignTokens.colors.genesisGray,
        200: genesisDesignTokens.colors.genesisLightGray,
        100: '#F8F8F8',
        50: genesisDesignTokens.colors.genesisWhite,
      },
    },
  },
  typography: {
    fontFamily: genesisDesignTokens.typography.fontFamily,
    h1: {
      fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', // Larger for luxury feel
      fontWeight: genesisDesignTokens.typography.fontWeights.light,
      lineHeight: 1.2,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0.025em', // Genesis uses wider letter spacing
      textTransform: 'uppercase', // Genesis Sans Head is all caps
    },
    h2: {
      fontSize: 'clamp(2rem, 4vw, 2.75rem)',
      fontWeight: genesisDesignTokens.typography.fontWeights.light,
      lineHeight: 1.25,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0.025em',
      textTransform: 'uppercase',
    },
    h3: {
      fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)',
      fontWeight: genesisDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.3,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0.025em',
      textTransform: 'uppercase',
    },
    h4: {
      fontSize: 'clamp(1.5rem, 3vw, 2rem)',
      fontWeight: genesisDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.35,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0.025em',
      textTransform: 'uppercase',
    },
    h5: {
      fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
      fontWeight: genesisDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.4,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0.025em',
    },
    h6: {
      fontSize: 'clamp(1.125rem, 2vw, 1.5rem)',
      fontWeight: genesisDesignTokens.typography.fontWeights.medium,
      lineHeight: 1.4,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0.01em',
    },
    body1: {
      fontSize: '1rem',
      fontWeight: genesisDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.6,
      color: genesisDesignTokens.colors.genesisWhite,
      letterSpacing: '0',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: genesisDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.6,
      color: genesisDesignTokens.colors.genesisGray,
      letterSpacing: '0',
    },
    button: {
      fontWeight: genesisDesignTokens.typography.fontWeights.semibold,
      textTransform: 'none',
      fontSize: '0.875rem',
      letterSpacing: '0.01em',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: genesisDesignTokens.typography.fontWeights.regular,
      lineHeight: 1.5,
      color: genesisDesignTokens.colors.genesisGray,
      letterSpacing: '0',
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: genesisDesignTokens.typography.fontWeights.semibold,
      lineHeight: 1.5,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: genesisDesignTokens.colors.genesisGray,
    },
  },
  shape: {
    borderRadius: genesisDesignTokens.spacing.borderRadius.medium,
  },
  spacing: genesisDesignTokens.spacing.baseUnit,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: genesisDesignTokens.typography.fontWeights.semibold,
          borderRadius: genesisDesignTokens.spacing.borderRadius.medium,
          padding: '12px 24px',
          fontSize: '0.875rem',
          letterSpacing: '0.01em',
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: genesisDesignTokens.shadows.button,
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          backgroundColor: genesisDesignTokens.colors.genesisWhite,
          color: genesisDesignTokens.colors.genesisBlack,
          '&:hover': {
            backgroundColor: genesisDesignTokens.colors.genesisLightGray,
          },
          '&:disabled': {
            backgroundColor: alpha(genesisDesignTokens.colors.genesisWhite, 0.12),
            color: alpha(genesisDesignTokens.colors.genesisWhite, 0.3),
          },
        },
        outlined: {
          borderColor: genesisDesignTokens.colors.genesisGray,
          color: genesisDesignTokens.colors.genesisWhite,
          borderWidth: '1.5px',
          '&:hover': {
            borderColor: genesisDesignTokens.colors.genesisWhite,
            backgroundColor: alpha(genesisDesignTokens.colors.genesisWhite, 0.08),
            borderWidth: '1.5px',
          },
          '&.selected': {
            borderColor: genesisDesignTokens.colors.genesisWhite,
            backgroundColor: genesisDesignTokens.colors.genesisWhite,
            color: genesisDesignTokens.colors.genesisBlack,
            '&:hover': {
              borderColor: genesisDesignTokens.colors.genesisLightGray,
              backgroundColor: genesisDesignTokens.colors.genesisLightGray,
            },
          },
        },
        text: {
          color: genesisDesignTokens.colors.genesisWhite,
          '&:hover': {
            backgroundColor: alpha(genesisDesignTokens.colors.genesisWhite, 0.08),
          },
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'secondary' },
          style: {
            backgroundColor: genesisDesignTokens.colors.genesisCopper,
            color: genesisDesignTokens.colors.genesisWhite,
            '&:hover': {
              backgroundColor: '#A65B45',
            },
          },
        },
        {
          props: { variant: 'genesis' } as any,
          style: {
            backgroundColor: 'transparent',
            color: genesisDesignTokens.colors.genesisWhite,
            border: `1.5px solid ${genesisDesignTokens.colors.genesisWhite}`,
            position: 'relative',
            overflow: 'hidden',
            '&:before': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: genesisDesignTokens.colors.genesisCopper,
              transform: 'scaleX(0)',
              transformOrigin: 'left',
              transition: 'transform 0.3s ease',
            },
            '&:hover': {
              backgroundColor: 'transparent',
              borderColor: genesisDesignTokens.colors.genesisWhite,
              '&:before': {
                transform: 'scaleX(1)',
              },
            },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: genesisDesignTokens.spacing.borderRadius.large,
          boxShadow: genesisDesignTokens.shadows.card,
          border: `1px solid ${alpha(genesisDesignTokens.colors.genesisGray, 0.2)}`,
          backgroundColor: genesisDesignTokens.colors.genesisCarbonDark,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: genesisDesignTokens.shadows.cardHover,
            transform: 'translateY(-2px)',
            borderColor: alpha(genesisDesignTokens.colors.genesisGray, 0.3),
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: genesisDesignTokens.colors.genesisBlack,
          boxShadow: genesisDesignTokens.shadows.appBar,
          color: genesisDesignTokens.colors.genesisWhite,
          borderBottom: `1px solid ${alpha(genesisDesignTokens.colors.genesisGray, 0.2)}`,
          '&.MuiAppBar-colorPrimary': {
            backgroundColor: genesisDesignTokens.colors.genesisCarbonDark,
            color: genesisDesignTokens.colors.genesisWhite,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(genesisDesignTokens.colors.genesisGray, 0.2),
          height: 2, // Thinner for elegance
          borderRadius: 0, // Sharp edges align with Genesis design
        },
        bar: {
          backgroundColor: genesisDesignTokens.colors.genesisCopper,
          borderRadius: 0,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: genesisDesignTokens.spacing.borderRadius.medium,
          fontWeight: genesisDesignTokens.typography.fontWeights.medium,
          border: '1px solid',
        },
        standardSuccess: {
          backgroundColor: alpha(genesisDesignTokens.colors.genesisLimeDark, 0.12),
          color: genesisDesignTokens.colors.genesisLimeDark,
          borderColor: alpha(genesisDesignTokens.colors.genesisLimeDark, 0.3),
        },
        standardError: {
          backgroundColor: alpha(genesisDesignTokens.colors.genesisRedDark, 0.12),
          color: genesisDesignTokens.colors.genesisRedDark,
          borderColor: alpha(genesisDesignTokens.colors.genesisRedDark, 0.3),
        },
        standardInfo: {
          backgroundColor: alpha(genesisDesignTokens.colors.genesisBlue, 0.12),
          color: genesisDesignTokens.colors.genesisBlue,
          borderColor: alpha(genesisDesignTokens.colors.genesisBlue, 0.3),
        },
        standardWarning: {
          backgroundColor: alpha(genesisDesignTokens.colors.genesisYellowDark, 0.12),
          color: genesisDesignTokens.colors.genesisYellowDark,
          borderColor: alpha(genesisDesignTokens.colors.genesisYellowDark, 0.3),
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: genesisDesignTokens.colors.genesisGray,
          '&.Mui-checked': {
            color: genesisDesignTokens.colors.genesisWhite,
          },
          '&:hover': {
            backgroundColor: alpha(genesisDesignTokens.colors.genesisWhite, 0.08),
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: genesisDesignTokens.colors.genesisGray,
          '&.Mui-checked': {
            color: genesisDesignTokens.colors.genesisWhite,
          },
          '&:hover': {
            backgroundColor: alpha(genesisDesignTokens.colors.genesisWhite, 0.08),
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
            color: genesisDesignTokens.colors.genesisWhite,
          },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(genesisDesignTokens.colors.genesisGray, 0.11),
          borderRadius: genesisDesignTokens.spacing.borderRadius.small,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: genesisDesignTokens.spacing.borderRadius.medium,
            '& fieldset': {
              borderColor: alpha(genesisDesignTokens.colors.genesisGray, 0.3),
            },
            '&:hover fieldset': {
              borderColor: genesisDesignTokens.colors.genesisGray,
            },
            '&.Mui-focused fieldset': {
              borderColor: genesisDesignTokens.colors.genesisWhite,
              borderWidth: '1.5px',
            },
            '& input': {
              color: genesisDesignTokens.colors.genesisWhite,
            },
          },
          '& .MuiInputLabel-root': {
            color: genesisDesignTokens.colors.genesisGray,
            '&.Mui-focused': {
              color: genesisDesignTokens.colors.genesisWhite,
            },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 2,
          '& .MuiSlider-rail': {
            color: alpha(genesisDesignTokens.colors.genesisGray, 0.3),
            opacity: 1,
            height: 2,
          },
          '& .MuiSlider-track': {
            border: 'none',
            height: 2,
            backgroundColor: genesisDesignTokens.colors.genesisWhite,
          },
          '& .MuiSlider-thumb': {
            height: 16,
            width: 16,
            backgroundColor: genesisDesignTokens.colors.genesisWhite,
            border: '2px solid currentColor',
            '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
              boxShadow: `0px 0px 0px 8px ${alpha(genesisDesignTokens.colors.genesisWhite, 0.12)}`,
            },
            '&:before': {
              display: 'none',
            },
          },
          '& .MuiSlider-valueLabel': {
            lineHeight: 1.2,
            fontSize: 12,
            background: genesisDesignTokens.colors.genesisWhite,
            color: genesisDesignTokens.colors.genesisBlack,
            padding: '4px 8px',
            borderRadius: genesisDesignTokens.spacing.borderRadius.small,
          },
          '& .MuiSlider-mark': {
            backgroundColor: alpha(genesisDesignTokens.colors.genesisGray, 0.5),
            height: 8,
            width: 1,
            '&.MuiSlider-markActive': {
              opacity: 1,
              backgroundColor: genesisDesignTokens.colors.genesisWhite,
            },
          },
          '& .MuiSlider-markLabel': {
            color: genesisDesignTokens.colors.genesisGray,
            fontSize: '0.75rem',
            fontWeight: genesisDesignTokens.typography.fontWeights.regular,
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
            paddingTop: '8px',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(genesisDesignTokens.colors.genesisGray, 0.2),
          '&.MuiDivider-withChildren': {
            '&:before, &:after': {
              borderColor: alpha(genesisDesignTokens.colors.genesisGray, 0.2),
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: genesisDesignTokens.spacing.borderRadius.small,
          fontWeight: genesisDesignTokens.typography.fontWeights.medium,
          backgroundColor: alpha(genesisDesignTokens.colors.genesisWhite, 0.08),
          color: genesisDesignTokens.colors.genesisWhite,
          '&.MuiChip-outlined': {
            borderColor: alpha(genesisDesignTokens.colors.genesisGray, 0.3),
            backgroundColor: 'transparent',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: genesisDesignTokens.colors.genesisWhite,
          color: genesisDesignTokens.colors.genesisBlack,
          fontSize: '0.75rem',
          fontWeight: genesisDesignTokens.typography.fontWeights.regular,
          padding: '8px 12px',
          borderRadius: genesisDesignTokens.spacing.borderRadius.small,
        },
        arrow: {
          color: genesisDesignTokens.colors.genesisWhite,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: genesisDesignTokens.colors.genesisCarbonDark,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${alpha(genesisDesignTokens.colors.genesisGray, 0.2)}`,
          color: genesisDesignTokens.colors.genesisWhite,
        },
        head: {
          color: genesisDesignTokens.colors.genesisGray,
          fontWeight: genesisDesignTokens.typography.fontWeights.semibold,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-switchBase': {
            color: genesisDesignTokens.colors.genesisGray,
            '&.Mui-checked': {
              color: genesisDesignTokens.colors.genesisWhite,
              '& + .MuiSwitch-track': {
                backgroundColor: genesisDesignTokens.colors.genesisCopper,
                opacity: 0.7,
              },
            },
          },
          '& .MuiSwitch-track': {
            backgroundColor: alpha(genesisDesignTokens.colors.genesisGray, 0.3),
          },
        },
      },
    },
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
          font-family: ${genesisDesignTokens.typography.fontFamily};
          background-color: ${genesisDesignTokens.colors.genesisBlack};
          color: ${genesisDesignTokens.colors.genesisWhite};
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
  },
});
