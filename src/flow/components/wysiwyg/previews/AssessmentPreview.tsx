/**
 * AssessmentPreview - Renders actual game components for preview
 */

import React from 'react';
import {
  Box,
  Typography,
  Alert,
} from '@mui/material';

import type { FlowNode } from '../../../types/flow';
import { UnifiedQuestionNode } from '../../../../components/UnifiedQuestionNode';
import { TrueFalseNode } from '../../../../components/TrueFalseNode';
import { LikertScaleNode } from '../../../../components/LikertScaleNode';
import { ShortAnswerNode } from '../../../../components/ShortAnswerNode';
import { RatingNode } from '../../../../components/RatingNode';
import { MatrixNode } from '../../../../components/MatrixNode';
import { SliderNode } from '../../../../components/SliderNode';
import { TextAreaNode } from '../../../../components/TextAreaNode';
import { MultiSelectNode } from '../../../../components/MultiSelectNode';
import { CheckboxNode } from '../../../../components/CheckboxNode';
import { MatchingNode } from '../../../../components/MatchingNode';
import { OrderingNode } from '../../../../components/OrderingNode';
import { ConnectionsNode } from '../../../../components/ConnectionsNode';
import { WordleNode } from '../../../../components/WordleNode';
import { InterstitialPanel } from '../../../../components/InterstitialPanel';

interface AssessmentPreviewProps {
  node: FlowNode;
  allNodes: FlowNode[];
  allEdges: any[];
  theme?: 'hyundai' | 'unfiltered' | 'custom';
}

export const AssessmentPreview: React.FC<AssessmentPreviewProps> = ({
  node,
  allNodes,
  allEdges,
}) => {
  const nodeType = node.data.nodeType;
  const nljNode = node.data.nljNode;

  // Get connected choice nodes for choice-based assessments
  const getConnectedChoiceNodes = () => {
    const connectedChoiceEdges = (allEdges || []).filter((edge: any) => 
      edge.source === node.id
    );
    
    // Use a Set to prevent duplicates and filter by unique node IDs
    const seenNodeIds = new Set<string>();
    const choiceNodes = connectedChoiceEdges
      .map((edge: any) => 
        (allNodes || []).find((n: any) => n.id === edge.target && n.data.nodeType === 'choice')
      )
      .filter((choiceNode: any) => {
        if (!choiceNode || seenNodeIds.has(choiceNode.id)) {
          return false;
        }
        seenNodeIds.add(choiceNode.id);
        return true;
      })
      .map((choiceNode: any) => choiceNode.data.nljNode);
    
    // Debug logging to identify duplicates
    console.log('AssessmentPreview - Raw edges:', connectedChoiceEdges);
    console.log('AssessmentPreview - Filtered choice nodes:', choiceNodes);
    
    return choiceNodes;
  };

  // Common props for all components
  const commonProps = {
    disabled: true, // Always disabled in preview
    onAnswer: () => {}, // No-op
    onChoiceSelect: () => {}, // No-op
    onContinue: () => {}, // No-op
  };

  // Render the appropriate component based on node type
  const renderPreview = () => {
    try {
      switch (nodeType) {
        case 'question':
          const choices = getConnectedChoiceNodes();
          return (
            <UnifiedQuestionNode
              question={nljNode as any}
              choices={choices as any}
              {...commonProps}
            />
          );

        case 'multi_select':
          return (
            <MultiSelectNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'checkbox':
          return (
            <CheckboxNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'matching':
          return (
            <MatchingNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'ordering':
          return (
            <OrderingNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'true_false':
          return (
            <TrueFalseNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'short_answer':
          return (
            <ShortAnswerNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'likert_scale':
          return (
            <LikertScaleNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'rating':
          return (
            <RatingNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'matrix':
          return (
            <MatrixNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'slider':
          return (
            <SliderNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'text_area':
          return (
            <TextAreaNode
              question={nljNode as any}
              {...commonProps}
            />
          );

        case 'connections':
          return (
            <ConnectionsNode
              question={nljNode as any}
              onAnswer={() => {}} // No-op for preview
            />
          );

        case 'wordle':
          return (
            <WordleNode
              question={nljNode as any}
              onAnswer={() => {}} // No-op for preview
            />
          );

        case 'interstitial_panel':
          return (
            <InterstitialPanel
              panel={nljNode as any}
              {...commonProps}
            />
          );

        default:
          return (
            <Alert severity="info">
              <Typography variant="body2">
                Preview not available for node type: {nodeType}
              </Typography>
            </Alert>
          );
      }
    } catch (error) {
      console.error('Error rendering preview:', error);
      return (
        <Alert severity="error">
          <Typography variant="body2">
            Error rendering preview: {(error as Error).message}
          </Typography>
        </Alert>
      );
    }
  };

  return (
    <Box sx={{ minHeight: 200 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        This is how your content will appear in the game:
      </Typography>
      
      <Box sx={{ 
        border: '2px solid', 
        borderColor: 'divider', 
        borderRadius: 2,
        p: 2,
        bgcolor: 'background.paper',
        position: 'relative',
        '&::before': {
          content: '"PREVIEW"',
          position: 'absolute',
          top: -10,
          right: 8,
          bgcolor: 'background.paper',
          color: 'text.secondary',
          fontSize: '0.75rem',
          px: 1,
          fontWeight: 'bold',
        }
      }}>
        {renderPreview()}
      </Box>
    </Box>
  );
};