import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Box, Typography, useTheme } from '@mui/material';
import { HtmlRenderer } from './HtmlRenderer';
import type { VariableContext } from '../utils/variableInterpolation';
import { interpolateVariables } from '../utils/variableInterpolation';
import { useVariableContext } from '../hooks/useVariableContext';

interface MarkdownRendererProps {
  content: string;
  sx?: object;
  component?: React.ElementType;
  // Variable interpolation props - now optional, will auto-use context if not provided
  variables?: VariableContext;
  enableInterpolation?: boolean;
  interpolationOptions?: {
    fallbackValue?: string;
    preserveUnknown?: boolean;
    formatters?: Record<string, (value: any) => string>;
  };
}

// Function to detect if content is HTML
const isHtmlContent = (content: string): boolean => {
  if (!content) return false;
  
  // Check for HTML tags and structure
  const htmlTags = /<(h[1-6]|p|div|span|strong|em|ul|ol|li|a|img|code|pre|blockquote|hr)\b[^>]*>/i;
  const hasHtmlTags = htmlTags.test(content);
  
  // If it has HTML tags and doesn't start with markdown syntax, it's probably HTML
  const startsWithMarkdown = /^(#{1,6}\s+|[*-]\s+|\d+\.\s+|>)/m.test(content);
  
  return hasHtmlTags && !startsWithMarkdown;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  sx = {},
  component = 'div',
  variables,
  enableInterpolation = true,
  interpolationOptions = {},
}) => {
  const theme = useTheme();
  const contextVariables = useVariableContext();
  
  // Use provided variables or fall back to context variables
  const finalVariables = variables || contextVariables;
  
  // Handle undefined or null content
  if (!content) {
    return null;
  }
  
  // Apply variable interpolation if enabled
  const processedContent = enableInterpolation 
    ? interpolateVariables(content, finalVariables, interpolationOptions)
    : content;
  
  // Debug: Log the content being rendered
  console.log('MarkdownRenderer content:', processedContent.substring(0, 100) + (processedContent.length > 100 ? '...' : ''));
  
  // If content is HTML, use the HtmlRenderer instead
  if (isHtmlContent(processedContent)) {
    console.log('Detected HTML content, using HtmlRenderer');
    return (
      <HtmlRenderer 
        content={processedContent} 
        sx={sx} 
        component={component}
        variables={finalVariables}
        enableInterpolation={false} // Already interpolated
        interpolationOptions={interpolationOptions}
      />
    );
  }
  
  console.log('Detected markdown content, using ReactMarkdown');

  const components = {
    // Typography components
    h1: ({ children, ...props }: any) => (
      <Typography 
        gutterBottom 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    h2: ({ children, ...props }: any) => (
      <Typography 
        gutterBottom 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    h3: ({ children, ...props }: any) => (
      <Typography 
        gutterBottom 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    h4: ({ children, ...props }: any) => (
      <Typography 
        gutterBottom 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    h5: ({ children, ...props }: any) => (
      <Typography 
        gutterBottom 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    h6: ({ children, ...props }: any) => (
      <Typography 
        gutterBottom 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    p: ({ children, ...props }: any) => (
      <Typography 
        paragraph 
        sx={{ 
          '&:first-of-type': { marginTop: 0 },
          ...props.sx 
        }} 
        {...props}
      >
        {children}
      </Typography>
    ),
    
    // Images
    img: ({ src, alt, ...props }: any) => {
      // Don't render if src is empty or invalid
      if (!src || src.trim() === '') {
        return null;
      }
      
      return (
        <Box
          component="img"
          src={src}
          alt={alt || ''}
          sx={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            margin: '1rem 0',
            borderRadius: 1,
            ...props.sx,
          }}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none';
          }}
          {...props}
        />
      );
    },
    
    // Lists
    ul: ({ children, ...props }: any) => (
      <Box component="ul" sx={{ pl: 2, mb: 2 }} {...props}>
        {children}
      </Box>
    ),
    ol: ({ children, ...props }: any) => (
      <Box component="ol" sx={{ pl: 2, mb: 2 }} {...props}>
        {children}
      </Box>
    ),
    li: ({ children, ...props }: any) => (
      <Typography component="li" sx={{ mb: 0.5 }} {...props}>
        {children}
      </Typography>
    ),
    
    // Links
    a: ({ href, children, ...props }: any) => (
      <Box
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: theme.palette.primary.main,
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    
    // Code
    code: ({ children, ...props }: any) => (
      <Box
        component="code"
        sx={{
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
          color: theme.palette.text.primary,
          padding: '0.2rem 0.4rem',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    
    // Code blocks
    pre: ({ children, ...props }: any) => (
      <Box
        component="pre"
        sx={{
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
          color: theme.palette.text.primary,
          padding: 2,
          borderRadius: 1,
          overflow: 'auto',
          mb: 2,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    
    // Blockquotes
    blockquote: ({ children, ...props }: any) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          pl: 2,
          ml: 0,
          mb: 2,
          fontStyle: 'italic',
          color: theme.palette.text.secondary,
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    
    // Tables
    table: ({ children, ...props }: any) => (
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          mb: 2,
          '& th, & td': {
            border: `1px solid ${theme.palette.divider}`,
            padding: 1,
            textAlign: 'left',
          },
          '& th': {
            backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[50],
            fontWeight: 'bold',
          },
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    
    // Horizontal rule
    hr: ({ ...props }: any) => (
      <Box
        component="hr"
        sx={{
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
          my: 2,
        }}
        {...props}
      />
    ),
    
    // Strong/Bold
    strong: ({ children, ...props }: any) => (
      <Typography component="strong" sx={{ fontWeight: 'bold' }} {...props}>
        {children}
      </Typography>
    ),
    
    // Emphasis/Italic
    em: ({ children, ...props }: any) => (
      <Typography component="em" sx={{ fontStyle: 'italic' }} {...props}>
        {children}
      </Typography>
    ),
  };

  return (
    <Box 
      component={component} 
      sx={{
        ...sx,
        // Remove top margin from first child element
        '& > *:first-of-type': {
          marginTop: '0 !important',
        },
        // Also handle ReactMarkdown's direct children
        '& > div > *:first-of-type': {
          marginTop: '0 !important',
        },
        // Be more specific about first paragraph/heading
        '& > p:first-of-type, & > h1:first-of-type, & > h2:first-of-type, & > h3:first-of-type': {
          marginTop: '0 !important',
        },
      }}
    >
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm]}
      >
        {processedContent}
      </ReactMarkdown>
    </Box>
  );
};