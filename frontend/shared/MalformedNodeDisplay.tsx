/**
 * Malformed Node Display Component
 * Specialized component for handling invalid or incomplete node data
 */

import React from 'react';
import { Alert, Box, Typography, Button, Card, CardContent, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Warning as WarningIcon, ExpandMore as ExpandMoreIcon, Home, SkipNext } from '@mui/icons-material';
import { NodeCard } from '../player/NodeCard';
import type { NLJNode } from '../types/nlj';

interface MalformedNodeDisplayProps {
  node: Partial<NLJNode>;
  error?: string;
  onSkip?: () => void;
  onHome?: () => void;
  showDetails?: boolean;
}

/**
 * Validates if a node has the minimum required properties
 */
export const validateNode = (node: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!node) {
    errors.push('Node is null or undefined');
    return { isValid: false, errors };
  }
  
  if (!node.id) {
    errors.push('Missing required property: id');
  }
  
  if (!node.type) {
    errors.push('Missing required property: type');
  }
  
  // Type-specific validation
  switch (node.type) {
    case 'question':
      if (!node.text && !node.content) {
        errors.push('Question nodes require either text or content');
      }
      break;
      
    case 'true_false':
      if (!node.text && !node.content) {
        errors.push('True/False nodes require either text or content');
      }
      if (node.correctAnswer === undefined || node.correctAnswer === null) {
        errors.push('True/False nodes require a correctAnswer property');
      }
      break;
      
    case 'short_answer':
      if (!node.text && !node.content) {
        errors.push('Short Answer nodes require either text or content');
      }
      if (!node.correctAnswers || !Array.isArray(node.correctAnswers) || node.correctAnswers.length === 0) {
        errors.push('Short Answer nodes require a non-empty correctAnswers array');
      }
      break;
      
    case 'ordering':
      if (!node.text && !node.content) {
        errors.push('Ordering nodes require either text or content');
      }
      if (!node.items || !Array.isArray(node.items) || node.items.length === 0) {
        errors.push('Ordering nodes require a non-empty items array');
      }
      break;
      
    case 'matching':
      if (!node.text && !node.content) {
        errors.push('Matching nodes require either text or content');
      }
      if (!node.leftItems || !Array.isArray(node.leftItems) || node.leftItems.length === 0) {
        errors.push('Matching nodes require a non-empty leftItems array');
      }
      if (!node.rightItems || !Array.isArray(node.rightItems) || node.rightItems.length === 0) {
        errors.push('Matching nodes require a non-empty rightItems array');
      }
      if (!node.correctMatches || !Array.isArray(node.correctMatches) || node.correctMatches.length === 0) {
        errors.push('Matching nodes require a non-empty correctMatches array');
      }
      break;
      
    case 'connections':
      if (!node.gameData) {
        errors.push('Connections nodes require gameData');
      } else if (!node.gameData.groups || !Array.isArray(node.gameData.groups) || node.gameData.groups.length !== 4) {
        errors.push('Connections nodes require exactly 4 groups in gameData.groups');
      }
      break;
      
    case 'wordle':
      if (!node.gameData) {
        errors.push('Wordle nodes require gameData');
      } else if (!node.gameData.targetWord) {
        errors.push('Wordle nodes require targetWord in gameData');
      }
      break;
  }
  
  return { isValid: errors.length === 0, errors };
};

/**
 * Component for displaying malformed or invalid nodes
 */
export const MalformedNodeDisplay: React.FC<MalformedNodeDisplayProps> = ({
  node,
  error,
  onSkip,
  onHome,
  showDetails = true
}) => {
  const validation = validateNode(node);
  const nodeType = node.type || 'unknown';
  const nodeId = node.id || 'missing';
  
  return (
    <NodeCard animate={false}>
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <WarningIcon color="warning" sx={{ mr: 2, fontSize: 32 }} />
          <Typography variant="h6">
            Invalid Content
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body1" gutterBottom>
            This content cannot be displayed due to invalid or incomplete data.
          </Typography>
          <Typography variant="body2">
            Node Type: <strong>{nodeType}</strong> • Node ID: <strong>{nodeId}</strong>
          </Typography>
        </Alert>

        {validation.errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="subtitle2" gutterBottom>
              Validation Errors:
            </Typography>
            <Typography component="ul" sx={{ pl: 2, mb: 0, fontSize: '0.875rem' }}>
              {validation.errors.map((err, index) => (
                <li key={index}>{err}</li>
              ))}
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Additional Error:</strong> {error}
            </Typography>
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This usually happens when:
        </Typography>
        <Typography component="ul" sx={{ textAlign: 'left', color: 'text.secondary', fontSize: '0.875rem', mb: 3 }}>
          <li>Content was imported from an incompatible format</li>
          <li>Required properties are missing from the node data</li>
          <li>The content structure doesn't match the expected schema</li>
          <li>There was an error during content generation or editing</li>
        </Typography>

        {showDetails && (
          <Accordion sx={{ mb: 3, textAlign: 'left' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Technical Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle2" gutterBottom>
                Raw Node Data:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.75rem',
                  backgroundColor: 'grey.100', 
                  p: 2, 
                  borderRadius: 1,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 300,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                {JSON.stringify(node, null, 2)}
              </Typography>
            </AccordionDetails>
          </Accordion>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {onSkip && (
            <Button
              variant="contained"
              startIcon={<SkipNext />}
              onClick={onSkip}
              color="primary"
            >
              Skip This Content
            </Button>
          )}
          {onHome && (
            <Button
              variant="outlined"
              startIcon={<Home />}
              onClick={onHome}
              color="secondary"
            >
              Return to Activities
            </Button>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          If this problem persists, please contact support with the node ID: {nodeId}
        </Typography>
      </Box>
    </NodeCard>
  );
};