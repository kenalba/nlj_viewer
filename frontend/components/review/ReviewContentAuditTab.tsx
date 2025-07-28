/**
 * Review Content Audit Tab - Printable linear view of all activity content
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider
} from '@mui/material';
import {
  Print as PrintIcon,
  Visibility as AuditIcon,
  ExpandMore as ExpandIcon,
  QuestionMark as QuestionIcon,
  AccountTree as FlowIcon,
  Settings as VariableIcon
} from '@mui/icons-material';
import { contentApi } from '../../api/content';
import type { PendingReview } from '../../types/workflow';
import type { NLJScenario, NLJNode } from '../../types/nlj';

interface ReviewContentAuditTabProps {
  review: PendingReview;
}

export const ReviewContentAuditTab: React.FC<ReviewContentAuditTabProps> = ({ review }) => {
  const [contentData, setContentData] = useState<NLJScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { content_id } = review;

  useEffect(() => {
    loadContentData();
  }, [content_id]);

  const loadContentData = async () => {
    try {
      setLoading(true);
      setError(null);
      const contentItem = await contentApi.get(content_id);
      setContentData({
        id: contentItem.id,
        name: contentItem.title,
        description: contentItem.description,
        ...contentItem.nlj_data
      });
    } catch (err: any) {
      console.error('Failed to load content data:', err);
      setError('Failed to load content data for audit.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getNodeTypeLabel = (nodeType: string): string => {
    const typeMap: Record<string, string> = {
      'start': 'Start Node',
      'end': 'End Node',
      'panel': 'Information Panel',
      'trueFalse': 'True/False Question',
      'multipleChoice': 'Multiple Choice Question',
      'ordering': 'Ordering Question',
      'matching': 'Matching Question',
      'shortAnswer': 'Short Answer Question',
      'likert': 'Likert Scale Question',
      'rating': 'Rating Question',
      'matrix': 'Matrix Question',
      'slider': 'Slider Question',
      'textArea': 'Text Area Question',
      'connections': 'Connections Game',
      'wordle': 'Wordle Game'
    };
    return typeMap[nodeType] || nodeType;
  };

  const getNodeIcon = (nodeType: string) => {
    if (['start', 'end', 'panel'].includes(nodeType)) {
      return <FlowIcon fontSize="small" />;
    }
    return <QuestionIcon fontSize="small" />;
  };

  const renderNodeContent = (node: NLJNode) => {
    const data = node.data || {};
    
    return (
      <Box sx={{ ml: 2 }}>
        {/* Basic Content */}
        {data.title && (
          <Typography variant="subtitle2" gutterBottom>
            <strong>Title:</strong> {data.title}
          </Typography>
        )}
        {data.content && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Content:</strong> {data.content}
          </Typography>
        )}
        {data.text && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Text:</strong> {data.text}
          </Typography>
        )}

        {/* Question-specific fields */}
        {data.question && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Question:</strong> {data.question}
          </Typography>
        )}

        {/* Choices for multiple choice, true/false, etc. */}
        {data.choices && Array.isArray(data.choices) && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              <strong>Choices:</strong>
            </Typography>
            <Box sx={{ ml: 2 }}>
              {data.choices.map((choice: any, index: number) => (
                <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                  • {typeof choice === 'string' ? choice : choice.text || choice.label}
                  {choice.correct && <Chip label="Correct" size="small" color="success" sx={{ ml: 1 }} />}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Items for ordering/matching */}
        {data.items && Array.isArray(data.items) && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              <strong>Items:</strong>
            </Typography>
            <Box sx={{ ml: 2 }}>
              {data.items.map((item: any, index: number) => (
                <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                  • {typeof item === 'string' ? item : item.text || item.content}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Pairs for matching */}
        {data.pairs && Array.isArray(data.pairs) && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              <strong>Matching Pairs:</strong>
            </Typography>
            <Box sx={{ ml: 2 }}>
              {data.pairs.map((pair: any, index: number) => (
                <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                  • {pair.left} ↔ {pair.right}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Correct answer */}
        {data.correctAnswer !== undefined && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Correct Answer:</strong> {String(data.correctAnswer)}
            <Chip label="Answer Key" size="small" color="info" sx={{ ml: 1 }} />
          </Typography>
        )}

        {/* Feedback */}
        {data.feedback && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Feedback:</strong> {data.feedback}
          </Typography>
        )}

        {/* Scale information for rating/likert */}
        {data.scale && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Scale:</strong> {data.scale.min || 1} to {data.scale.max || 5}
            {data.scale.labels && ` (${data.scale.labels.join(', ')})`}
          </Typography>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8}>
        <CircularProgress size={40} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading content for audit...
        </Typography>
      </Box>
    );
  }

  if (error || !contentData) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error || 'Failed to load content data'}
      </Alert>
    );
  }

  const questionNodes = contentData.nodes?.filter(node => 
    !['start', 'end', 'panel'].includes(node.type)
  ) || [];

  const totalNodes = contentData.nodes?.length || 0;
  const totalConnections = contentData.links?.length || 0;

  return (
    <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
      {/* Header - Hidden in print */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50' }} className="no-print">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AuditIcon color="primary" />
              Content Audit
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Comprehensive review of all content, questions, and structure for offline analysis.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ minWidth: 120 }}
          >
            Print Audit
          </Button>
        </Box>
      </Paper>

      {/* Summary Statistics */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Content Summary
        </Typography>
        <Box display="flex" gap={4} mb={2}>
          <Box>
            <Typography variant="h4" color="primary.main" fontWeight="bold">
              {totalNodes}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Nodes
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="secondary.main" fontWeight="bold">
              {questionNodes.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Questions/Games
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="info.main" fontWeight="bold">
              {totalConnections}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Connections
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* All Nodes */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Complete Node Structure
        </Typography>
        
        {contentData.nodes?.map((node, index) => (
          <Accordion key={node.id} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Box display="flex" alignItems="center" gap={2} width="100%">
                {getNodeIcon(node.type)}
                <Typography variant="subtitle1" fontWeight={600}>
                  Node {index + 1}: {node.data?.title || node.id}
                </Typography>
                <Chip 
                  label={getNodeTypeLabel(node.type)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {renderNodeContent(node)}
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* Flow Connections */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlowIcon />
          Flow Connections
        </Typography>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>From Node</strong></TableCell>
                <TableCell><strong>To Node</strong></TableCell>
                <TableCell><strong>Connection Type</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contentData.links?.map((link, index) => {
                const sourceNode = contentData.nodes?.find(n => n.id === link.sourceNodeId);
                const targetNode = contentData.nodes?.find(n => n.id === link.targetNodeId);
                
                return (
                  <TableRow key={link.id || index}>
                    <TableCell>
                      {sourceNode?.data?.title || link.sourceNodeId}
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        ({getNodeTypeLabel(sourceNode?.type || 'unknown')})
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {targetNode?.data?.title || link.targetNodeId}
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        ({getNodeTypeLabel(targetNode?.type || 'unknown')})
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {link.condition ? 'Conditional' : 'Direct'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Variables */}
      {contentData.variableDefinitions && contentData.variableDefinitions.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VariableIcon />
            Variable Definitions
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Variable Name</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Default Value</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contentData.variableDefinitions.map((variable, index) => (
                  <TableRow key={variable.name || index}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {variable.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{variable.type}</TableCell>
                    <TableCell>
                      {variable.defaultValue !== undefined ? String(variable.defaultValue) : 'N/A'}
                    </TableCell>
                    <TableCell>{variable.description || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Footer - Print only */}
      <Box sx={{ display: 'none', '@media print': { display: 'block', mt: 4, pt: 2, borderTop: '1px solid #ccc' } }}>
        <Typography variant="caption" color="text.secondary">
          Content Audit Report - Generated on {new Date().toLocaleString()}
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          Activity: {contentData.name} (Version {review.version_number})
        </Typography>
      </Box>
    </Box>
  );
};

export default ReviewContentAuditTab;