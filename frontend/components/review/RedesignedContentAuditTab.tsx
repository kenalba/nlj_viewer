/**
 * Redesigned Content Audit Tab - Linear, scannable content review focused on quality assurance
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Print as PrintIcon,
  Visibility as AuditIcon,
  QuestionMark as QuestionIcon,
  AccountTree as FlowIcon,
  Settings as VariableIcon,
  CheckCircle as CorrectIcon,
  Cancel as IncorrectIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  PlayArrow as StartIcon,
  Stop as EndIcon,
  Article as PanelIcon,
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon
} from '@mui/icons-material';
import { MarkdownRenderer } from '../../shared/MarkdownRenderer';
import { contentApi } from '../../api/content';
import type { PendingReview } from '../../types/workflow';
import type { NLJScenario, NLJNode } from '../../types/nlj';

interface RedesignedContentAuditTabProps {
  review: PendingReview;
}

export const RedesignedContentAuditTab: React.FC<RedesignedContentAuditTabProps> = ({ review }) => {
  const [contentData, setContentData] = useState<NLJScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState(true);

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

  const getNodeIcon = (nodeType: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      start: <StartIcon />,
      end: <EndIcon />,
      panel: <PanelIcon />,
      trueFalse: <QuestionIcon />,
      multipleChoice: <QuestionIcon />,
      checkbox: <QuestionIcon />,
      ordering: <QuestionIcon />,
      matching: <QuestionIcon />,
      shortAnswer: <QuestionIcon />,
      likert: <QuestionIcon />,
      rating: <QuestionIcon />,
      matrix: <QuestionIcon />,
      slider: <QuestionIcon />,
      textArea: <QuestionIcon />,
      connections: <QuestionIcon />,
      wordle: <QuestionIcon />
    };
    return iconMap[nodeType] || <QuestionIcon />;
  };

  const getNodeTypeLabel = (nodeType: string): string => {
    const typeMap: Record<string, string> = {
      start: 'Start Node',
      end: 'End Node',
      panel: 'Information Panel',
      trueFalse: 'True/False Question',
      multipleChoice: 'Multiple Choice Question',
      checkbox: 'Checkbox Question',
      ordering: 'Ordering Question',
      matching: 'Matching Question',
      shortAnswer: 'Short Answer Question',
      likert: 'Likert Scale Question',
      rating: 'Rating Question',
      matrix: 'Matrix Question',
      slider: 'Slider Question',
      textArea: 'Text Area Question',
      connections: 'Connections Game',
      wordle: 'Wordle Game'
    };
    return typeMap[nodeType] || nodeType;
  };

  const getContentQualityIndicators = (node: NLJNode) => {
    const indicators: Array<{ type: 'error' | 'warning' | 'info', message: string }> = [];
    
    // Access node data directly - it might be at the root level
    const nodeData = node.data || node;

    // Check for missing content
    if (!nodeData.title && !nodeData.content && !nodeData.text && !nodeData.question) {
      indicators.push({ type: 'error', message: 'No content provided' });
    }

    // Check question-specific issues
    if (['trueFalse', 'multipleChoice'].includes(node.type)) {
      if (!nodeData.choices || nodeData.choices.length === 0) {
        indicators.push({ type: 'error', message: 'No answer choices provided' });
      } else {
        const hasCorrectAnswer = nodeData.choices.some((choice: any) => choice.isCorrect || choice.correct);
        if (!hasCorrectAnswer) {
          indicators.push({ type: 'warning', message: 'No correct answer marked' });
        }
      }
    }

    // Check checkbox questions
    if (node.type === 'checkbox') {
      if (!nodeData.options || nodeData.options.length === 0) {
        indicators.push({ type: 'error', message: 'No checkbox options provided' });
      } else {
        const hasCorrectAnswer = nodeData.options.some((option: any) => option.isCorrect);
        if (!hasCorrectAnswer) {
          indicators.push({ type: 'warning', message: 'No correct answers marked' });
        }
      }
    }

    // Check content length
    const contentText = nodeData.question || nodeData.content || nodeData.text || '';
    if (contentText.length > 500) {
      indicators.push({ type: 'warning', message: 'Content may be too long' });
    }
    if (contentText.length < 10 && ['trueFalse', 'multipleChoice', 'checkbox', 'shortAnswer'].includes(node.type)) {
      indicators.push({ type: 'warning', message: 'Content may be too short' });
    }

    return indicators;
  };

  const renderQuestionContent = (node: NLJNode) => {
    // Access node data directly - it might be at the root level  
    const data = node.data || node;
    
    // For 'question' type nodes, find associated choice nodes using the same logic as the game player
    // Use parent-child links to connect question nodes to choice nodes (like scenarioUtils.getChoicesForQuestion)
    const choiceNodes = node.type === 'question' && contentData?.links ? 
      (() => {
        const parentChildLinks = contentData.links.filter(
          link => link.type === 'parent-child' && link.sourceNodeId === node.id
        );
        
        // Use a Set to prevent duplicates based on node ID
        const seenNodeIds = new Set<string>();
        return parentChildLinks
          .map(link => contentData.nodes?.find(n => n.id === link.targetNodeId))
          .filter((n): n is any => {
            if (!n || n.type !== 'choice' || seenNodeIds.has(n.id)) {
              return false;
            }
            seenNodeIds.add(n.id);
            return true;
          });
      })() : [];
    
    return (
      <Box>
        {/* Main Question Content */}
        <Box sx={{ mb: 3 }}>
          {data.title && (
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
              {data.title}
            </Typography>
          )}
          
          {/* Combined Content - Text and Content together like players see */}
          {(data.text || data.question || data.content) && (
            <Box sx={{ 
              mb: 2,
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.200'
            }}>
              <MarkdownRenderer
                content={String([
                  data.text || data.question || '',
                  data.content || ''
                ].filter(Boolean).join('\n\n'))}
                sx={{ color: 'text.primary' }}
              />
            </Box>
          )}
        </Box>

        {/* Answer Choices (Multiple Choice, True/False, etc.) - embedded choices */}
        {data.choices && Array.isArray(data.choices) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Answer Choices:
            </Typography>
            <Stack spacing={1}>
              {data.choices.map((choice: any, index: number) => {
                const isCorrect = choice.isCorrect || choice.correct;
                return (
                  <Box 
                    key={index} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      p: 1.5,
                      bgcolor: isCorrect ? 'success.50' : 'background.paper',
                      border: '1px solid',
                      borderColor: isCorrect ? 'success.200' : 'grey.200',
                      borderRadius: 1
                    }}
                  >
                    {isCorrect ? (
                      <CorrectIcon color="success" />
                    ) : (
                      <IncorrectIcon color="disabled" />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <MarkdownRenderer
                        content={String(typeof choice === 'string' ? choice : choice.text || choice.label || '')}
                        sx={{ fontSize: '1rem' }}
                      />
                      {choice.feedback && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Feedback:
                          </Typography>
                          <MarkdownRenderer
                            content={String(choice.feedback || '')}
                            sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'text.secondary' }}
                          />
                        </Box>
                      )}
                    </Box>
                    {isCorrect && (
                      <Chip label="Correct Answer" size="small" color="success" />
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
        
        {/* Debug: Show what we're looking for */}
        {node.type === 'question' && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'info.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Looking for choices for question {node.id}. Found {choiceNodes.length} choice nodes.
              {choiceNodes.length === 0 && (
                <><br />Links: {contentData?.links?.filter(l => l.type === 'parent-child' && l.sourceNodeId === node.id).map(l => `${l.sourceNodeId}->${l.targetNodeId}`).join(', ') || 'none'}</>
              )}
            </Typography>
          </Box>
        )}
        
        {/* Answer Choices for 'question' type nodes with separate ChoiceNode children */}
        {node.type === 'question' && choiceNodes.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Answer Choices:
            </Typography>
            <Stack spacing={1}>
              {choiceNodes.map((choiceNode: any, index: number) => {
                const isCorrect = choiceNode.isCorrect || choiceNode.choiceType === 'CORRECT';
                const choiceData = choiceNode.data || choiceNode;
                return (
                  <Box 
                    key={choiceNode.id || index} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      p: 1.5,
                      bgcolor: isCorrect ? 'success.50' : 'background.paper',
                      border: '1px solid',
                      borderColor: isCorrect ? 'success.200' : 'grey.200',
                      borderRadius: 1
                    }}
                  >
                    {isCorrect ? (
                      <CorrectIcon color="success" />
                    ) : (
                      <IncorrectIcon color="disabled" />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <MarkdownRenderer
                        content={String(choiceData.text || choiceNode.text || '')}
                        sx={{ fontSize: '1rem' }}
                      />
                      {(choiceData.feedback || choiceNode.feedback) && (
                        <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Choice Feedback:
                          </Typography>
                          <MarkdownRenderer
                            content={String(choiceData.feedback || choiceNode.feedback || '')}
                            sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'text.secondary' }}
                          />
                        </Box>
                      )}
                    </Box>
                    {isCorrect && (
                      <Chip label="Correct Answer" size="small" color="success" />
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
        
        {/* Show message when question has no choices found */}
        {node.type === 'question' && choiceNodes.length === 0 && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
            <Typography variant="body2" color="warning.main">
              ⚠️ This question node has no associated choice nodes found. This may indicate a data structure issue.
            </Typography>
          </Box>
        )}
        

        {/* Checkbox Options */}
        {data.options && Array.isArray(data.options) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Checkbox Options:
            </Typography>
            {(data.minSelections || data.maxSelections) && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selection requirements: 
                {data.minSelections && ` minimum ${data.minSelections}`}
                {data.minSelections && data.maxSelections && ','}
                {data.maxSelections && ` maximum ${data.maxSelections}`}
              </Typography>
            )}
            <Stack spacing={1}>
              {data.options.map((option: any, index: number) => {
                const isCorrect = option.isCorrect;
                return (
                  <Box 
                    key={option.id || index} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      p: 1.5,
                      bgcolor: isCorrect ? 'success.50' : 'background.paper',
                      border: '1px solid',
                      borderColor: isCorrect ? 'success.200' : 'grey.200',
                      borderRadius: 1
                    }}
                  >
                    {isCorrect ? (
                      <CorrectIcon color="success" />
                    ) : (
                      <IncorrectIcon color="disabled" />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <MarkdownRenderer
                        content={String(option.text || '')}
                        sx={{ fontSize: '1rem' }}
                      />
                    </Box>
                    {isCorrect && (
                      <Chip label="Correct" size="small" color="success" />
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Ordering Question Items */}
        {node.type === 'ordering' && data.items && Array.isArray(data.items) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Ordering Question - Correct Sequence:
            </Typography>
            <Stack spacing={1}>
              {data.items
                .sort((a: any, b: any) => (a.correctOrder || 0) - (b.correctOrder || 0))
                .map((item: any, index: number) => (
                  <Box key={item.id || index} sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    bgcolor: 'info.50',
                    border: '1px solid',
                    borderColor: 'info.200',
                    borderRadius: 1
                  }}>
                    <Typography variant="body2" sx={{ 
                      minWidth: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: 'info.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold'
                    }}>
                      {item.correctOrder || index + 1}
                    </Typography>
                    <MarkdownRenderer
                      content={String(item.text || item.content || '')}
                      sx={{ fontSize: '1rem', flex: 1 }}
                    />
                  </Box>
                ))
              }
            </Stack>
          </Box>
        )}
        
        {/* Generic Items (for other question types) */}
        {node.type !== 'ordering' && data.items && Array.isArray(data.items) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Items:
            </Typography>
            <Stack spacing={1}>
              {data.items.map((item: any, index: number) => (
                <Typography key={index} variant="body1" sx={{ 
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 1
                }}>
                  {index + 1}. {typeof item === 'string' ? item : item.text || item.content}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {/* Matching Question - Left Items, Right Items, and Correct Matches */}
        {(data.leftItems || data.rightItems || data.correctMatches) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Matching Question:
            </Typography>
            
            {/* Left Column Items */}
            {data.leftItems && Array.isArray(data.leftItems) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Left Column:
                </Typography>
                <Stack spacing={1}>
                  {data.leftItems.map((item: any, index: number) => (
                    <Box key={item.id || index} sx={{ 
                      p: 1.5,
                      bgcolor: 'primary.50',
                      border: '1px solid',
                      borderColor: 'primary.200',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <Typography variant="body2" sx={{ 
                        minWidth: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {index + 1}
                      </Typography>
                      <MarkdownRenderer
                        content={String(item.text || '')}
                        sx={{ fontSize: '1rem' }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
            
            {/* Right Column Items */}
            {data.rightItems && Array.isArray(data.rightItems) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'secondary.main' }}>
                  Right Column:
                </Typography>
                <Stack spacing={1}>
                  {data.rightItems.map((item: any, index: number) => (
                    <Box key={item.id || index} sx={{ 
                      p: 1.5,
                      bgcolor: 'secondary.50',
                      border: '1px solid',
                      borderColor: 'secondary.200',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <Typography variant="body2" sx={{ 
                        minWidth: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'secondary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {String.fromCharCode(65 + index)}
                      </Typography>
                      <MarkdownRenderer
                        content={String(item.text || '')}
                        sx={{ fontSize: '1rem' }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
            
            {/* Correct Matches */}
            {data.correctMatches && Array.isArray(data.correctMatches) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'success.main' }}>
                  Correct Matches:
                </Typography>
                <Stack spacing={1}>
                  {data.correctMatches.map((match: any, index: number) => {
                    // Find the corresponding left and right items
                    const leftItem = data.leftItems?.find((item: any) => item.id === match.leftId);
                    const rightItem = data.rightItems?.find((item: any) => item.id === match.rightId);
                    
                    return (
                      <Box key={index} sx={{ 
                        p: 1.5,
                        bgcolor: 'success.50',
                        border: '1px solid',
                        borderColor: 'success.200',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                      }}>
                        <CorrectIcon color="success" />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <MarkdownRenderer
                            content={String(leftItem?.text || match.leftId || '')}
                            sx={{ fontSize: '0.875rem', fontWeight: 500 }}
                          />
                          <Typography variant="body2" color="text.secondary">↔</Typography>
                          <MarkdownRenderer
                            content={String(rightItem?.text || match.rightId || '')}
                            sx={{ fontSize: '0.875rem', fontWeight: 500 }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Box>
        )}
        
        {/* Legacy Matching Pairs (for backward compatibility) */}
        {data.pairs && Array.isArray(data.pairs) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Matching Pairs:
            </Typography>
            <Stack spacing={1}>
              {data.pairs.map((pair: any, index: number) => (
                <Typography key={index} variant="body1" sx={{ 
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 1
                }}>
                  {pair.left} ↔ {pair.right}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {/* True/False Questions */}
        {(node.type === 'trueFalse' || node.type === 'true_false') && data.correctAnswer !== undefined && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Correct Answer:
            </Typography>
            <Box sx={{ 
              p: 2,
              bgcolor: 'success.50',
              border: '1px solid',
              borderColor: 'success.200',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <CorrectIcon color="success" />
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {data.correctAnswer === true || data.correctAnswer === 'true' ? 'TRUE' : 'FALSE'}
              </Typography>
            </Box>
          </Box>
        )}
        
        {/* Short Answer Questions - Correct Answers (plural) */}
        {(node.type === 'shortAnswer' || node.type === 'short_answer') && data.correctAnswers && Array.isArray(data.correctAnswers) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Accepted Answers:
            </Typography>
            {data.caseSensitive !== undefined && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Case sensitive: {data.caseSensitive ? 'Yes' : 'No'}
              </Typography>
            )}
            <Stack spacing={1}>
              {data.correctAnswers.map((answer: string, index: number) => (
                <Box key={index} sx={{ 
                  p: 1.5,
                  bgcolor: 'success.50',
                  border: '1px solid',
                  borderColor: 'success.200',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <CorrectIcon color="success" />
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    "{String(answer)}"
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Generic Correct Answer for other question types (singular) */}
        {data.correctAnswer !== undefined && 
         !data.correctAnswers && 
         node.type !== 'trueFalse' && 
         node.type !== 'true_false' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Expected Answer:
            </Typography>
            <Box sx={{ 
              p: 2,
              bgcolor: 'success.50',
              border: '1px solid',
              borderColor: 'success.200',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <CorrectIcon color="success" />
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {String(data.correctAnswer)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Unified Question Feedback */}
        {(data.feedback || node.feedback) && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Learner Feedback:
            </Typography>
            {(() => {
              // Use node-level feedback first, then data-level feedback
              const feedbackContent = data.feedback || node.feedback;
              
              // Handle object-based feedback with correct/incorrect properties
              if (typeof feedbackContent === 'object' && feedbackContent !== null) {
                return (
                  <Stack spacing={1}>
                    {feedbackContent.correct && (
                      <Box sx={{ 
                        p: 2,
                        bgcolor: 'success.50',
                        border: '1px solid',
                        borderColor: 'success.200',
                        borderRadius: 1
                      }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'success.main' }}>
                          Correct Feedback:
                        </Typography>
                        <MarkdownRenderer
                          content={String(feedbackContent.correct)}
                          sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                        />
                      </Box>
                    )}
                    {feedbackContent.incorrect && (
                      <Box sx={{ 
                        p: 2,
                        bgcolor: 'error.50',
                        border: '1px solid',
                        borderColor: 'error.200',
                        borderRadius: 1
                      }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'error.main' }}>
                          Incorrect Feedback:
                        </Typography>
                        <MarkdownRenderer
                          content={String(feedbackContent.incorrect)}
                          sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                        />
                      </Box>
                    )}
                    {/* Handle general feedback property in object */}
                    {feedbackContent.general && (
                      <Box sx={{ 
                        p: 2,
                        bgcolor: 'info.50',
                        border: '1px solid',
                        borderColor: 'info.200',
                        borderRadius: 1
                      }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'info.main' }}>
                          General Feedback:
                        </Typography>
                        <MarkdownRenderer
                          content={String(feedbackContent.general)}
                          sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                        />
                      </Box>
                    )}
                  </Stack>
                );
              } else {
                // Handle string-based unified feedback
                return (
                  <Box sx={{ 
                    p: 2,
                    bgcolor: 'info.50',
                    border: '1px solid',
                    borderColor: 'info.200',
                    borderRadius: 1
                  }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'info.main' }}>
                      Unified Feedback:
                    </Typography>
                    <MarkdownRenderer
                      content={String(feedbackContent || '')}
                      sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                    />
                  </Box>
                );
              }
            })()}
          </Box>
        )}

        {/* Scale information */}
        {data.scale && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Scale Information:
            </Typography>
            <Typography variant="body2" sx={{ 
              p: 1,
              bgcolor: 'grey.50',
              borderRadius: 1
            }}>
              Range: {data.scale.min || 1} to {data.scale.max || 5}
              {data.scale.labels && ` (${data.scale.labels.join(', ')})`}
            </Typography>
          </Box>
        )}

        {/* Variable Changes */}
        {data.variableChanges && Array.isArray(data.variableChanges) && data.variableChanges.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Variable Changes:
            </Typography>
            <Stack spacing={1}>
              {data.variableChanges.map((change: any, index: number) => (
                <Box key={index} sx={{ 
                  p: 1,
                  bgcolor: 'warning.50',
                  border: '1px solid',
                  borderColor: 'warning.200',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <VariableIcon fontSize="small" color="warning" />
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {change.variableId}: {change.operation} {change.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  const renderNodeCard = (node: NLJNode, index: number) => {
    const indicators = getContentQualityIndicators(node);
    const isQuestion = !['start', 'end', 'panel', 'branch'].includes(node.type);
    const nodeNumber = index + 1;
    
    // Access node data directly - it might be at the root level
    const nodeData = node.data || node;

    return (
      <Card key={node.id} sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          {/* Node Header */}
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ 
                bgcolor: isQuestion ? 'primary.main' : 'grey.400',
                color: 'white',
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getNodeIcon(node.type)}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {nodeNumber}. {nodeData.title || `Node ${nodeNumber}`}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip 
                    label={getNodeTypeLabel(node.type)}
                    size="small"
                    color={isQuestion ? 'primary' : 'default'}
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    ID: {node.id}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Quality Indicators */}
            {indicators.length > 0 && (
              <Box display="flex" gap={0.5}>
                {indicators.map((indicator, idx) => (
                  <Tooltip key={idx} title={indicator.message}>
                    <IconButton size="small" color={indicator.type as any}>
                      {indicator.type === 'error' ? <WarningIcon /> : <InfoIcon />}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            )}
          </Box>

          {/* Content */}
          {isQuestion ? renderQuestionContent(node) : (
            <Box>
              {/* Panel/Info Content - Combined text and content like players see it */}
              {(nodeData.text || nodeData.content) && (
                <Box sx={{ 
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}>
                  <MarkdownRenderer
                    content={String([
                      nodeData.text || '',
                      nodeData.content || ''
                    ].filter(Boolean).join('\n\n'))}
                    sx={{ color: 'text.primary' }}
                  />
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
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

  // Filter out choice sub-nodes - only show main content nodes
  const mainNodes = contentData.nodes?.filter(node => {
    // Exclude nodes that look like choice sub-nodes (usually have parent references)
    if (node.type === 'choice' || node.id?.includes('choice') || node.id?.includes('option')) {
      return false;
    }
    return true;
  }) || [];

  const totalNodes = mainNodes.length;
  const questionNodes = mainNodes.filter(node => 
    !['start', 'end', 'panel', 'branch'].includes(node.type)
  );
  const qualityIssues = mainNodes.reduce((acc, node) => 
    acc + getContentQualityIndicators(node).length, 0
  );

  return (
    <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.50' }} className="no-print">
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AuditIcon color="primary" />
              Content Audit Report
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Linear review of all content for quality assurance and validation.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ minWidth: 120 }}
          >
            Print Report
          </Button>
        </Box>

        {/* Quick Stats */}
        <Box display="flex" gap={4} alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h4" color="primary.main" fontWeight="bold">
              {totalNodes}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Nodes
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h4" color="secondary.main" fontWeight="bold">
              {questionNodes.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Questions
            </Typography>
          </Box>
          {qualityIssues > 0 && (
            <Box display="flex" alignItems="center" gap={1}>
              <Badge badgeContent={qualityIssues} color="warning">
                <WarningIcon color="warning" />
              </Badge>
              <Typography variant="body2" color="text.secondary">
                Quality Issues
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Content Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Activity: {contentData.name}
        </Typography>
        {contentData.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {contentData.description}
          </Typography>
        )}
        
        {/* Variable Definitions */}
        {contentData.variableDefinitions && contentData.variableDefinitions.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Variables Used:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {contentData.variableDefinitions.map((variable, index) => (
                <Chip 
                  key={index}
                  label={`${variable.name} (${variable.type})`}
                  size="small"
                  icon={<VariableIcon />}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Linear Content Review */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Content Review ({totalNodes} nodes)
        </Typography>
        
        {mainNodes.map((node, index) => renderNodeCard(node, index))}
      </Box>

      {/* Footer for Print */}
      <Box sx={{ 
        display: 'none', 
        '@media print': { 
          display: 'block', 
          mt: 4, 
          pt: 2, 
          borderTop: '1px solid #ccc',
          pageBreakInside: 'avoid'
        } 
      }}>
        <Typography variant="caption" color="text.secondary">
          Content Audit Report - Generated on {new Date().toLocaleString()}
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          Activity: {contentData.name} (Version {review.version_number}) - {totalNodes} nodes, {questionNodes.length} questions
        </Typography>
      </Box>
    </Box>
  );
};

export default RedesignedContentAuditTab;