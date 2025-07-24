/**
 * Utility functions for markdown detection and conversion
 */

import { marked } from 'marked';
import type { NLJNode, NLJScenario } from '../types/nlj';

// Type for choice objects that can have text/content properties
interface ChoiceWithContent {
  text?: string;
  content?: string;
  [key: string]: any;
}

// Configure marked for our use case
marked.setOptions({
  breaks: true, // Convert line breaks to <br>
  gfm: true,    // Enable GitHub Flavored Markdown
});

// Simple markdown-to-HTML converter using marked
export const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  // If it already looks like HTML (contains HTML tags), return as-is
  if (markdown.includes('<') && markdown.includes('>')) {
    return markdown;
  }
  
  try {
    // Use marked to convert markdown to HTML synchronously
    const html = marked.parse(markdown, { async: false }) as string;
    return html;
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    // Fallback to returning the original markdown if conversion fails
    return markdown;
  }
};

// Function to detect if content is markdown
export const isMarkdownContent = (content: string): boolean => {
  if (!content) return false;
  
  // If it already contains HTML tags, it's likely HTML
  if (content.includes('<') && content.includes('>')) {
    return false;
  }
  
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers (# ## ###)
    /\*\*.*?\*\*/,           // Bold (**text**)
    /\*.*?\*/,               // Italic (*text*)
    /`.*?`/,                 // Inline code (`code`)
    /\[.*?\]\(.*?\)/,        // Links [text](url)
    /!\[.*?\]\(.*?\)/,       // Images ![alt](src)
    /^-\s+/m,                // Unordered lists (- item)
    /^\d+\.\s+/m,            // Ordered lists (1. item)
    /^>\s+/m,                // Blockquotes (> text)
    /^---$/m,                // Horizontal rules (---)
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
};

// Function to convert markdown content in a node
export const convertNodeMarkdownToHtml = (node: NLJNode): NLJNode => {
  const convertedNode = { ...node };
  
  // Convert text field if it exists and is markdown
  if ((convertedNode as any).text && isMarkdownContent((convertedNode as any).text)) {
    (convertedNode as any).text = convertMarkdownToHtml((convertedNode as any).text);
  }
  
  // Convert content field if it exists and is markdown
  if ((convertedNode as any).content && isMarkdownContent((convertedNode as any).content)) {
    (convertedNode as any).content = convertMarkdownToHtml((convertedNode as any).content);
  }
  
  // Convert description field if it exists and is markdown
  if (convertedNode.description && isMarkdownContent(convertedNode.description)) {
    convertedNode.description = convertMarkdownToHtml(convertedNode.description);
  }
  
  // Convert title field if it exists and is markdown
  if (convertedNode.title && isMarkdownContent(convertedNode.title)) {
    convertedNode.title = convertMarkdownToHtml(convertedNode.title);
  }
  
  // Convert choice content if it exists (for choice nodes)
  if ((convertedNode as any).choices && Array.isArray((convertedNode as any).choices)) {
    (convertedNode as any).choices = (convertedNode as any).choices.map((choice: ChoiceWithContent) => {
      const convertedChoice = { ...choice };
      if (convertedChoice.text && isMarkdownContent(convertedChoice.text)) {
        convertedChoice.text = convertMarkdownToHtml(convertedChoice.text);
      }
      if (convertedChoice.content && isMarkdownContent(convertedChoice.content)) {
        convertedChoice.content = convertMarkdownToHtml(convertedChoice.content);
      }
      return convertedChoice;
    });
  }
  
  return convertedNode;
};

// Function to convert markdown content in an entire scenario
export const convertScenarioMarkdownToHtml = (scenario: NLJScenario): NLJScenario => {
  const convertedScenario = {
    ...scenario,
    nodes: scenario.nodes.map(convertNodeMarkdownToHtml)
  };
  
  return convertedScenario;
};