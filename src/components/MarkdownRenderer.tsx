import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Box, Typography, useTheme } from '@mui/material';

interface MarkdownRendererProps {
  content: string;
  sx?: object;
  component?: React.ElementType;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  sx = {},
  component = 'div',
}) => {
  const theme = useTheme();

  const components = {
    // Typography components
    h1: ({ children, ...props }: any) => (
      <Typography gutterBottom {...props}>
        {children}
      </Typography>
    ),
    h2: ({ children, ...props }: any) => (
      <Typography gutterBottom {...props}>
        {children}
      </Typography>
    ),
    h3: ({ children, ...props }: any) => (
      <Typography gutterBottom {...props}>
        {children}
      </Typography>
    ),
    h4: ({ children, ...props }: any) => (
      <Typography gutterBottom {...props}>
        {children}
      </Typography>
    ),
    h5: ({ children, ...props }: any) => (
      <Typography gutterBottom {...props}>
        {children}
      </Typography>
    ),
    h6: ({ children, ...props }: any) => (
      <Typography gutterBottom {...props}>
        {children}
      </Typography>
    ),
    p: ({ children, ...props }: any) => (
      <Typography paragraph {...props}>
        {children}
      </Typography>
    ),
    
    // Images
    img: ({ src, alt, ...props }: any) => (
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={{
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
          margin: '1rem 0',
          borderRadius: 1,
          ...props.sx,
        }}
        {...props}
      />
    ),
    
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
    <Box component={component} sx={sx}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};