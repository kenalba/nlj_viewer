/**
 * Centralized node type classification utilities
 * Extracted from repeated patterns across FlowNode, NodeEditSidebar, NodePalette, and NodeHeader
 */

import React from 'react';
import {
  PlayArrow as StartIcon,
  Stop as EndIcon,
  Quiz as QuestionIcon,
  CheckCircle as ChoiceIcon,
  Article as InterstitialIcon,
  CheckBox as TrueFalseIcon,
  Reorder as OrderingIcon,
  Link as MatchingIcon,
  Edit as ShortAnswerIcon,
  BarChart as LikertIcon,
  Star as RatingIcon,
  Grid3x3 as MatrixIcon,
  Tune as SliderIcon,
  Notes as TextAreaIcon,
  CheckBoxOutlineBlank as MultiSelectIcon,
  CheckBox as CheckboxIcon,
  SportsEsports as ConnectionsIcon,
  Games as WordleIcon,
} from '@mui/icons-material';

import { NODE_TYPE_INFO } from './flowUtils';
import type { FlowNodeType } from '../types/flow';

/**
 * Get the Material-UI icon component for a node type
 */
export function getNodeIcon(nodeType: FlowNodeType): React.ReactElement {
  switch (nodeType) {
    case 'start':
      return <StartIcon />;
    case 'end':
      return <EndIcon />;
    case 'question':
      return <QuestionIcon />;
    case 'choice':
      return <ChoiceIcon />;
    case 'interstitial_panel':
      return <InterstitialIcon />;
    case 'true_false':
      return <TrueFalseIcon />;
    case 'ordering':
      return <OrderingIcon />;
    case 'matching':
      return <MatchingIcon />;
    case 'short_answer':
      return <ShortAnswerIcon />;
    case 'likert_scale':
      return <LikertIcon />;
    case 'rating':
      return <RatingIcon />;
    case 'matrix':
      return <MatrixIcon />;
    case 'slider':
      return <SliderIcon />;
    case 'text_area':
      return <TextAreaIcon />;
    case 'multi_select':
      return <MultiSelectIcon />;
    case 'checkbox':
      return <CheckboxIcon />;
    case 'connections':
      return <ConnectionsIcon />;
    case 'wordle':
      return <WordleIcon />;
    default:
      return <QuestionIcon />;
  }
}

/**
 * Get node type information from the centralized lookup
 */
export function getNodeTypeInfo(nodeType: FlowNodeType) {
  return NODE_TYPE_INFO[nodeType] || NODE_TYPE_INFO.question;
}

/**
 * Check if a node type uses choice nodes
 */
export function usesChoiceNodes(nodeType: FlowNodeType): boolean {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.hasChoices;
}

/**
 * Check if a node type is self-contained (doesn't need external connections)
 */
export function isSelfContained(nodeType: FlowNodeType): boolean {
  const gameTypes = ['connections', 'wordle'];
  const surveyTypes = ['likert_scale', 'rating', 'matrix', 'slider', 'text_area'];
  const simpleQuestions = ['true_false', 'short_answer'];
  
  return gameTypes.includes(nodeType) || surveyTypes.includes(nodeType) || simpleQuestions.includes(nodeType);
}

/**
 * Check if a node type is a game
 */
export function isGame(nodeType: FlowNodeType): boolean {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.category === 'game';
}

/**
 * Check if a node type supports media
 */
export function supportsMedia(nodeType: FlowNodeType): boolean {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.supportsMedia;
}

/**
 * Check if a node type has interactive elements
 */
export function hasInteractiveElements(nodeType: FlowNodeType): boolean {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.isInteractive;
}

/**
 * Get the display name for a node type
 */
export function getNodeTypeDisplayName(nodeType: FlowNodeType): string {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.label;
}

/**
 * Get the description for a node type
 */
export function getNodeTypeDescription(nodeType: FlowNodeType): string {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.description;
}

/**
 * Get the category for a node type
 */
export function getNodeTypeCategory(nodeType: FlowNodeType): string {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.category;
}

/**
 * Get the color for a node type
 */
export function getNodeTypeColor(nodeType: FlowNodeType): string {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.color;
}

/**
 * Get the emoji icon for a node type
 */
export function getNodeTypeEmoji(nodeType: FlowNodeType): string {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.icon;
}

/**
 * Get all node types in a specific category
 */
export function getNodeTypesByCategory(category: string): FlowNodeType[] {
  return Object.keys(NODE_TYPE_INFO).filter(
    nodeType => NODE_TYPE_INFO[nodeType].category === category
  ) as FlowNodeType[];
}

/**
 * Get all available node categories
 */
export function getNodeCategories(): string[] {
  const categories = new Set<string>();
  Object.values(NODE_TYPE_INFO).forEach(info => {
    categories.add(info.category);
  });
  return Array.from(categories);
}

/**
 * Check if a node type is a question type
 */
export function isQuestionType(nodeType: FlowNodeType): boolean {
  const questionTypes = [
    'question',
    'true_false',
    'ordering',
    'matching',
    'short_answer',
    'multi_select',
    'checkbox'
  ];
  return questionTypes.includes(nodeType);
}

/**
 * Check if a node type is a survey type
 */
export function isSurveyType(nodeType: FlowNodeType): boolean {
  const surveyTypes = [
    'likert_scale',
    'rating',
    'matrix',
    'slider',
    'text_area'
  ];
  return surveyTypes.includes(nodeType);
}

/**
 * Check if a node type is a structure type
 */
export function isStructureType(nodeType: FlowNodeType): boolean {
  const typeInfo = getNodeTypeInfo(nodeType);
  return typeInfo.category === 'structure';
}

/**
 * Get all node types that support the specified feature
 */
export function getNodeTypesByFeature(feature: keyof typeof NODE_TYPE_INFO[string]): FlowNodeType[] {
  return Object.keys(NODE_TYPE_INFO).filter(
    nodeType => NODE_TYPE_INFO[nodeType][feature] === true
  ) as FlowNodeType[];
}

/**
 * Validate if a node type is valid
 */
export function isValidNodeType(nodeType: string): nodeType is FlowNodeType {
  return nodeType in NODE_TYPE_INFO;
}

/**
 * Get the default node type for a category
 */
export function getDefaultNodeTypeForCategory(category: string): FlowNodeType {
  const typesInCategory = getNodeTypesByCategory(category);
  if (typesInCategory.length === 0) {
    return 'question'; // fallback
  }
  return typesInCategory[0];
}

/**
 * Get question type label (for backward compatibility)
 */
export function getQuestionType(nodeType: FlowNodeType): string {
  return getNodeTypeDisplayName(nodeType);
}

/**
 * Get game type label (for backward compatibility)
 */
export function getGameType(nodeType: FlowNodeType): string | undefined {
  if (isGame(nodeType)) {
    return getNodeTypeDisplayName(nodeType);
  }
  return undefined;
}

/**
 * Get choice label (for backward compatibility)
 */
export function getChoiceLabel(nodeType: FlowNodeType): string {
  return getNodeTypeDisplayName(nodeType);
}