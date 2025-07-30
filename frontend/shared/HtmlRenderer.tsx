import React, { useMemo } from 'react';
import { Box, useTheme } from '@mui/material';
import { interpolateVariables, type VariableContext, DEFAULT_FORMATTERS } from '../utils/variableInterpolation';

interface HtmlRendererProps {
  content: string;
  sx?: object;
  component?: React.ElementType;
  // Variable interpolation props
  variables?: VariableContext;
  enableInterpolation?: boolean;
  interpolationOptions?: {
    fallbackValue?: string;
    preserveUnknown?: boolean;
    formatters?: Record<string, (value: any) => string>;
  };
}

export const HtmlRenderer: React.FC<HtmlRendererProps> = ({
  content,
  sx = {},
  component = 'div',
  variables = {},
  enableInterpolation = true,
  interpolationOptions = {},
}) => {
  const theme = useTheme();

  // Handle undefined or null content
  if (!content) {
    return null;
  }

  // Apply variable interpolation if enabled and variables are provided
  const processedContent = useMemo(() => {
    if (!enableInterpolation || Object.keys(variables).length === 0) {
      return content;
    }

    const {
      fallbackValue = '???',
      preserveUnknown = false,
      formatters = DEFAULT_FORMATTERS,
    } = interpolationOptions;

    return interpolateVariables(content, variables, {
      fallbackValue,
      preserveUnknown,
      formatters,
    });
  }, [content, variables, enableInterpolation, interpolationOptions]);

  return (
    <Box
      component={component}
      sx={{
        // Base styling for HTML content
        '& h1': {
          fontSize: theme.typography.h4.fontSize,
          fontWeight: theme.typography.h4.fontWeight,
          marginBottom: theme.spacing(2),
          marginTop: theme.spacing(3),
          '&:first-of-type': { marginTop: 0 },
          color: theme.palette.text.primary,
        },
        '& h2': {
          fontSize: theme.typography.h5.fontSize,
          fontWeight: theme.typography.h5.fontWeight,
          marginBottom: theme.spacing(1.5),
          marginTop: theme.spacing(2.5),
          '&:first-of-type': { marginTop: 0 },
          color: theme.palette.text.primary,
        },
        '& h3': {
          fontSize: theme.typography.h6.fontSize,
          fontWeight: theme.typography.h6.fontWeight,
          marginBottom: theme.spacing(1),
          marginTop: theme.spacing(2),
          '&:first-of-type': { marginTop: 0 },
          color: theme.palette.text.primary,
        },
        '& p': {
          fontSize: theme.typography.body1.fontSize,
          lineHeight: theme.typography.body1.lineHeight,
          marginBottom: theme.spacing(1.5),
          '&:first-of-type': { marginTop: 0 },
          '&:last-child': { marginBottom: 0 },
          color: theme.palette.text.primary,
        },
        '& strong': {
          fontWeight: theme.typography.fontWeightBold,
        },
        '& em': {
          fontStyle: 'italic',
        },
        '& ul': {
          marginLeft: theme.spacing(2),
          marginBottom: theme.spacing(1.5),
          '& li': {
            marginBottom: theme.spacing(0.5),
          },
        },
        '& ol': {
          marginLeft: theme.spacing(2),
          marginBottom: theme.spacing(1.5),
          '& li': {
            marginBottom: theme.spacing(0.5),
          },
        },
        '& a': {
          color: theme.palette.primary.main,
          textDecoration: 'underline',
          '&:hover': {
            textDecoration: 'none',
          },
        },
        '& code': {
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
          color: theme.palette.text.primary,
          padding: theme.spacing(0.25, 0.5),
          borderRadius: theme.shape.borderRadius,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        },
        '& pre': {
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
          color: theme.palette.text.primary,
          padding: theme.spacing(2),
          borderRadius: theme.shape.borderRadius,
          overflow: 'auto',
          marginBottom: theme.spacing(1.5),
          '& code': {
            backgroundColor: 'transparent',
            padding: 0,
          },
        },
        '& blockquote': {
          borderLeft: `4px solid ${theme.palette.divider}`,
          paddingLeft: theme.spacing(2),
          marginLeft: 0,
          marginBottom: theme.spacing(1.5),
          fontStyle: 'italic',
          color: theme.palette.text.secondary,
        },
        '& hr': {
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
          marginTop: theme.spacing(2),
          marginBottom: theme.spacing(2),
        },
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: theme.shape.borderRadius,
        },
        // Remove top margin from first child element
        '& > *:first-of-type': {
          marginTop: '0 !important',
        },
        ...sx,
      }}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};