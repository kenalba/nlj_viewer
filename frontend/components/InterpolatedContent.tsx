/**
 * InterpolatedContent - Renders content with variable interpolation support
 */

import React, { useMemo } from 'react';
import { Typography, TypographyProps } from '@mui/material';
import { interpolateVariables, type VariableContext, DEFAULT_FORMATTERS } from '../utils/variableInterpolation';

interface InterpolatedContentProps extends Omit<TypographyProps, 'children'> {
  content: string;
  variables: VariableContext;
  fallbackValue?: string;
  preserveUnknown?: boolean;
  formatters?: Record<string, (value: any) => string>;
  // HTML rendering options
  enableHtml?: boolean;
  component?: React.ElementType;
}

export const InterpolatedContent: React.FC<InterpolatedContentProps> = ({
  content,
  variables,
  fallbackValue = '???',
  preserveUnknown = false,
  formatters = DEFAULT_FORMATTERS,
  enableHtml = true,
  component = 'span',
  ...typographyProps
}) => {
  const interpolatedContent = useMemo(() => {
    if (!content) return '';
    
    return interpolateVariables(content, variables, {
      fallbackValue,
      preserveUnknown,
      formatters,
    });
  }, [content, variables, fallbackValue, preserveUnknown, formatters]);

  if (enableHtml && interpolatedContent.includes('<')) {
    // Render HTML content with interpolation
    return (
      <Typography
        {...typographyProps}
        component={component}
        dangerouslySetInnerHTML={{ __html: interpolatedContent }}
      />
    );
  }

  // Render plain text with interpolation
  return (
    <Typography {...typographyProps} component={component}>
      {interpolatedContent}
    </Typography>
  );
};

/**
 * Hook for variable interpolation in components
 */
export function useVariableInterpolation(variables: VariableContext) {
  return useMemo(() => ({
    interpolate: (text: string, options?: {
      fallbackValue?: string;
      preserveUnknown?: boolean;
      formatters?: Record<string, (value: any) => string>;
    }) => {
      if (!text) return text;
      
      return interpolateVariables(text, variables, {
        fallbackValue: options?.fallbackValue ?? '???',
        preserveUnknown: options?.preserveUnknown ?? false,
        formatters: options?.formatters ?? DEFAULT_FORMATTERS,
      });
    },
    variables,
  }), [variables]);
}

export default InterpolatedContent;