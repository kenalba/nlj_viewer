import * as XLSX from 'xlsx';
import type { NLJScenario, NLJNode, Link, ChoiceNode, QuestionNode, TrueFalseNode, OrderingNode, MatchingNode, ShortAnswerNode } from '../types/nlj';
import { debugLog } from './debug';

// Trivie quiz structure (inferred from common quiz formats)
export interface TrivieQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'ordering' | 'matching';
  choices?: TrivieChoice[];
  correctAnswer?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
  points?: number;
}

export interface TrivieChoice {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface TrivieQuiz {
  id: string;
  title: string;
  description?: string;
  questions: TrivieQuestion[];
  settings?: {
    timeLimit?: number;
    randomizeQuestions?: boolean;
    randomizeChoices?: boolean;
    showCorrectAnswers?: boolean;
    allowRetry?: boolean;
  };
}

/**
 * Parse Excel file and extract Trivie quiz data
 */
export async function parseTrivieExcel(file: File): Promise<TrivieQuiz[]> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    debugLog('Trivie Parser', 'Parsing Excel file', {
      sheetNames: workbook.SheetNames,
      fileName: file.name
    });

    const quizzes: TrivieQuiz[] = [];
    
    // Process each sheet as a potential quiz
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      debugLog('Trivie Parser', `Found sheet: ${sheetName}`);

      // Try to interpret the sheet data as a quiz
      const quiz = parseSheetAsQuiz(sheetName, jsonData as unknown[][]);
      if (quiz) {
        quizzes.push(quiz);
      }
    }

    return quizzes;
  } catch (error) {
    debugLog('Trivie Parser', 'Error parsing Excel file', { error });
    throw new Error(`Failed to parse Trivie Excel file: ${error}`);
  }
}

/**
 * Parse a worksheet as a quiz
 */
function parseSheetAsQuiz(sheetName: string, data: unknown[][]): TrivieQuiz | null {
  if (!data || data.length < 2) return null;

  try {
    // Assume first row contains headers
    const headers = data[0] as string[];
    const rows = data.slice(1);
    
    debugLog('Trivie Parser', `Processing sheet: ${sheetName} (${data.length} rows)`);

    // Common column mappings for quiz formats
    const columnMap = detectColumnMapping(headers);
    
    if (!columnMap.question) {
      debugLog('Trivie Parser', `No question column found in sheet: ${sheetName}`);
      return null;
    }

    const questions: TrivieQuestion[] = [];
    let questionId = 1;

    for (const row of rows) {
      if (!row || !row[columnMap.question]) continue;

      debugLog('Trivie Parser', `Processing question ${questionId}`, {
        questionText: String(row[columnMap.question] || '').substring(0, 50) + '...',
        questionType: columnMap.questionType ? row[columnMap.questionType] : 'unknown',
        hasChoices: !!(row[columnMap.choiceA] || row[columnMap.choiceB])
      });

      const question: TrivieQuestion = {
        id: `q${questionId}`,
        question: String(row[columnMap.question]).trim(),
        type: 'multiple_choice',
        choices: [],
        correctAnswer: columnMap.correctAnswer ? String(row[columnMap.correctAnswer] || '') : '',
        explanation: columnMap.explanation ? String(row[columnMap.explanation] || '') : '',
        difficulty: columnMap.difficulty ? (String(row[columnMap.difficulty] || 'medium') as 'easy' | 'medium' | 'hard') : 'medium',
        category: columnMap.category ? String(row[columnMap.category] || '') : '',
        points: columnMap.points ? Number(row[columnMap.points]) || 1 : 1
      };

      // Parse choices (assuming they might be in separate columns or comma-separated)
      const choices = parseChoices(row, columnMap);
      question.choices = choices;
      
      debugLog('Trivie Parser', `Question ${questionId} parsed: ${choices.length} choices`);

      // Determine question type from the question_type column
      if (columnMap.questionType && row[columnMap.questionType]) {
        const questionType = String(row[columnMap.questionType]).toLowerCase().trim();
        if (questionType.includes('true') || questionType.includes('false')) {
          question.type = 'true_false';
        } else if (questionType.includes('ordering')) {
          question.type = 'ordering';
        } else if (questionType.includes('matching')) {
          question.type = 'matching';
        } else if (questionType.includes('short') || questionType.includes('answer')) {
          question.type = 'short_answer';
        } else {
          question.type = 'multiple_choice';
        }
      } else {
        // Fallback to old detection logic
        if (choices.length === 2 && choices.some(c => c.text.toLowerCase().includes('true') || c.text.toLowerCase().includes('false'))) {
          question.type = 'true_false';
        } else if (choices.length === 0) {
          question.type = 'short_answer';
        }
      }

      questions.push(question);
      questionId++;
    }

    return {
      id: `quiz_${sheetName.toLowerCase().replace(/\s+/g, '_')}`,
      title: sheetName,
      description: `Quiz imported from ${sheetName}`,
      questions,
      settings: {
        randomizeQuestions: false,
        randomizeChoices: false,
        showCorrectAnswers: true,
        allowRetry: true
      }
    };
  } catch (error) {
    debugLog('Trivie Parser', `Error parsing sheet: ${sheetName}`, { error });
    return null;
  }
}

/**
 * Detect column mapping from headers
 */
function detectColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  headers.forEach((header, index) => {
    if (!header) return;
    
    const h = header.toLowerCase().trim();
    
    // Question column detection - be more specific to avoid question_type  
    if (h === 'question') {
      mapping.question = index;
    } else if (h.includes('prompt') || h.includes('ask')) {
      mapping.question = index;
    }
    
    // Question type column detection
    if (h === 'question_type') {
      mapping.questionType = index;
    }
    
    // Trivie-specific answer columns
    if (h === 'answer_1') mapping.choiceA = index;
    if (h === 'answer_2') mapping.choiceB = index;
    if (h === 'answer_3') mapping.choiceC = index;
    if (h === 'answer_4') mapping.choiceD = index;
    
    // Trivie-specific feedback columns
    if (h === 'answer_1_feedback') mapping.feedbackA = index;
    if (h === 'answer_2_feedback') mapping.feedbackB = index;
    if (h === 'answer_3_feedback') mapping.feedbackC = index;
    if (h === 'answer_4_feedback') mapping.feedbackD = index;
    
    // Fallback answer choices detection - only if not already found
    if (h.includes('choice') || h.includes('option') || (h.includes('answer') && !h.includes('_'))) {
      if ((h.includes('a') || h.includes('1')) && mapping.choiceA === undefined) mapping.choiceA = index;
      if ((h.includes('b') || h.includes('2')) && mapping.choiceB === undefined) mapping.choiceB = index;
      if ((h.includes('c') || h.includes('3')) && mapping.choiceC === undefined) mapping.choiceC = index;
      if ((h.includes('d') || h.includes('4')) && mapping.choiceD === undefined) mapping.choiceD = index;
    }
    
    // Correct answer detection - Trivie uses 'correct_choices'
    if (h === 'correct_choices' || h.includes('correct') || h.includes('right') || h.includes('key')) {
      mapping.correctAnswer = index;
    }
    
    // Explanation detection - Trivie uses 'general_feedback'
    if (h === 'general_feedback' || h.includes('explanation') || h.includes('feedback') || h.includes('rationale')) {
      mapping.explanation = index;
    }
    
    // Difficulty detection
    if (h.includes('difficulty') || h.includes('level')) {
      mapping.difficulty = index;
    }
    
    // Category detection - Trivie uses 'topic'
    if (h === 'topic' || h.includes('category') || h.includes('topic') || h.includes('subject')) {
      mapping.category = index;
    }
    
    // Points detection
    if (h.includes('points') || h.includes('score') || h.includes('weight')) {
      mapping.points = index;
    }
  });

  debugLog('Trivie Parser', 'Column mapping detected', {
    questionCol: mapping.question,
    choiceCols: [mapping.choiceA, mapping.choiceB, mapping.choiceC, mapping.choiceD].filter(c => c !== undefined),
    feedbackCols: [mapping.feedbackA, mapping.feedbackB, mapping.feedbackC, mapping.feedbackD].filter(c => c !== undefined),
    correctAnswerCol: mapping.correctAnswer
  });

  return mapping;
}

/**
 * Parse choices from row data
 */
function parseChoices(row: unknown[], columnMap: Record<string, number>): TrivieChoice[] {
  const choices: TrivieChoice[] = [];
  
  // Get correct answers (Trivie format: "A,C" or "1,3")
  const correctAnswers = new Set<string>();
  if (columnMap.correctAnswer !== undefined && row[columnMap.correctAnswer]) {
    const correctStr = String(row[columnMap.correctAnswer]).trim();
    // Split by comma and normalize (handle both "A,C" and "1,3" formats)
    correctStr.split(',').forEach(answer => {
      const trimmed = answer.trim();
      correctAnswers.add(trimmed.toUpperCase());
      // Also add number-to-letter mapping (1->A, 2->B, etc.)
      if (trimmed === '1') correctAnswers.add('A');
      if (trimmed === '2') correctAnswers.add('B');
      if (trimmed === '3') correctAnswers.add('C');
      if (trimmed === '4') correctAnswers.add('D');
    });
  }
  
  // Check for individual choice columns (A, B, C, D)
  const choiceColumns = ['choiceA', 'choiceB', 'choiceC', 'choiceD'];
  const feedbackColumns = ['feedbackA', 'feedbackB', 'feedbackC', 'feedbackD'];
  const choiceLabels = ['A', 'B', 'C', 'D'];
  
  for (let i = 0; i < choiceColumns.length; i++) {
    const columnIndex = columnMap[choiceColumns[i]];
    
    if (columnIndex !== undefined && row[columnIndex]) {
      const choiceText = String(row[columnIndex]).trim();
      if (choiceText) {
        const isCorrect = correctAnswers.has(choiceLabels[i]) || correctAnswers.has(String(i + 1));
        
        // Extract choice-specific feedback
        const feedbackIndex = columnMap[feedbackColumns[i]];
        let feedback = '';
        if (feedbackIndex !== undefined && row[feedbackIndex]) {
          feedback = String(row[feedbackIndex]).trim();
        }
        
        choices.push({
          id: `choice_${choiceLabels[i].toLowerCase()}`,
          text: choiceText,
          isCorrect,
          explanation: feedback
        });
      }
    }
  }
  
  // Only log if there are parsing issues
  if (choices.length === 0 && (columnMap.choiceA !== undefined || columnMap.choiceB !== undefined)) {
    debugLog('Trivie Parser', 'No choices parsed despite having choice columns', {
      choicesFound: choices.length,
      correctAnswers: Array.from(correctAnswers)
    });
  }
  
  return choices;
}

/**
 * Convert Trivie quiz to NLJ scenario format
 */
export function convertTrivieToNLJ(quiz: TrivieQuiz): NLJScenario {
  const nodes: NLJNode[] = [];
  const links: Link[] = [];
  
  // Create start node
  const startNode: NLJNode = {
    id: 'start',
    type: 'start',
    x: 100,
    y: 100,
    width: 100,
    height: 50
  };
  nodes.push(startNode);
  
  // Create all question nodes and choice nodes first
  const allChoiceNodes: ChoiceNode[][] = [];
  
  quiz.questions.forEach((question, questionIndex) => {
    const questionNodeId = `question_${questionIndex + 1}`;
    
    // Create question node based on type
    let questionNode: NLJNode;
    
    switch (question.type) {
      case 'true_false':
        questionNode = {
          id: questionNodeId,
          type: 'true_false',
          text: question.question,
          content: question.explanation || '',
          x: 200 + (questionIndex * 300),
          y: 200,
          width: 200,
          height: 100,
          additionalMediaList: [],
          correctAnswer: question.choices?.[0]?.text?.toLowerCase().includes('true') || false
        } as TrueFalseNode;
        break;
        
      case 'ordering':
        questionNode = {
          id: questionNodeId,
          type: 'ordering',
          text: question.question,
          content: question.explanation || '',
          x: 200 + (questionIndex * 300),
          y: 200,
          width: 200,
          height: 100,
          additionalMediaList: [],
          items: question.choices?.map((choice, index) => ({
            id: `${questionNodeId}_item_${index}`,
            text: choice.text,
            correctOrder: choice.isCorrect ? 1 : index + 1 // This needs better logic
          })) || []
        } as OrderingNode;
        break;
        
      case 'matching': {
        // Parse matching pairs from "leftItem->rightItem" format
        const matchingPairs = question.choices?.map(choice => {
          const parts = choice.text.split('->');
          if (parts.length === 2) {
            return {
              left: parts[0].trim(),
              right: parts[1].trim(),
              isCorrect: choice.isCorrect
            };
          }
          return null;
        }).filter(pair => pair !== null) || [];
        
        // Extract unique left and right items
        const leftItems = Array.from(new Set(matchingPairs.map(p => p!.left)));
        const rightItems = Array.from(new Set(matchingPairs.map(p => p!.right)));
        
        // Create correct matches from the pairs marked as correct
        const correctMatches = matchingPairs
          .filter(pair => pair!.isCorrect)
          .map(pair => ({
            leftId: `${questionNodeId}_left_${leftItems.indexOf(pair!.left)}`,
            rightId: `${questionNodeId}_right_${rightItems.indexOf(pair!.right)}`
          }));
        
        questionNode = {
          id: questionNodeId,
          type: 'matching',
          text: question.question,
          content: question.explanation || '',
          x: 200 + (questionIndex * 300),
          y: 200,
          width: 200,
          height: 100,
          additionalMediaList: [],
          leftItems: leftItems.map((item, index) => ({
            id: `${questionNodeId}_left_${index}`,
            text: item
          })),
          rightItems: rightItems.map((item, index) => ({
            id: `${questionNodeId}_right_${index}`,
            text: item
          })),
          correctMatches: correctMatches
        } as MatchingNode;
        break;
      }
        
      case 'short_answer': {
        questionNode = {
          id: questionNodeId,
          type: 'short_answer',
          text: question.question,
          content: question.explanation || '',
          x: 200 + (questionIndex * 300),
          y: 200,
          width: 200,
          height: 100,
          additionalMediaList: [],
          correctAnswers: question.choices?.filter(c => c.isCorrect).map(c => c.text) || [],
          caseSensitive: false
        } as ShortAnswerNode;
        break;
      }
        
      default: {// multiple_choice
        questionNode = {
          id: questionNodeId,
          type: 'question',
          text: question.question,
          content: question.explanation || '',
          x: 200 + (questionIndex * 300),
          y: 200,
          width: 200,
          height: 100,
          additionalMediaList: []
        } as QuestionNode;
        break;
      }
    }
    
    nodes.push(questionNode);
    
    // Create choice nodes only for multiple choice questions
    const choiceNodes: ChoiceNode[] = [];
    if (question.type === 'multiple_choice') {
      question.choices?.forEach((choice, choiceIndex) => {
        const choiceNodeId = `${questionNodeId}_choice_${choiceIndex + 1}`;
        
        const choiceNode: ChoiceNode = {
          id: choiceNodeId,
          type: 'choice',
          parentId: questionNodeId,
          text: choice.text,
          feedback: choice.explanation || '',
          isCorrect: choice.isCorrect,
          choiceType: choice.isCorrect ? 'CORRECT' : 'INCORRECT',
          x: 200 + (questionIndex * 300),
          y: 300 + (choiceIndex * 50),
          width: 150,
          height: 40,
          variableChanges: choice.isCorrect ? [{
            variableId: 'score',
            value: question.points || 1
          }] : []
        };
        
        choiceNodes.push(choiceNode);
        nodes.push(choiceNode);
      });
    }
    
    allChoiceNodes.push(choiceNodes);
    
    // Only log if there are issues
    if (choiceNodes.length === 0 && question.type === 'multiple_choice') {
      debugLog('Trivie Converter', `No choice nodes created for multiple choice question ${questionIndex + 1}`);
    }
  });
  
  // Create end node
  const endNode: NLJNode = {
    id: 'end',
    type: 'end',
    x: 200 + (quiz.questions.length * 300),
    y: 200,
    width: 100,
    height: 50
  };
  nodes.push(endNode);
  
  // Now create all links
  quiz.questions.forEach((_, questionIndex) => {
    const questionNodeId = `question_${questionIndex + 1}`;
    const choiceNodes = allChoiceNodes[questionIndex];
    
    // Link from previous node to this question
    if (questionIndex === 0) {
      // Link from start to first question
      links.push({
        id: `start_to_${questionNodeId}`,
        type: 'link',
        sourceNodeId: 'start',
        targetNodeId: questionNodeId,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 }
      });
    } else {
      // Link from previous question (or its choices) to this question
      const prevQuestion = quiz.questions[questionIndex - 1];
      const prevChoiceNodes = allChoiceNodes[questionIndex - 1];
      
      if (prevQuestion.type === 'multiple_choice' && prevChoiceNodes.length > 0) {
        // Link from previous question choices to this question
        prevChoiceNodes.forEach(prevChoice => {
          links.push({
            id: `${prevChoice.id}_to_${questionNodeId}`,
            type: 'link',
            sourceNodeId: prevChoice.id,
            targetNodeId: questionNodeId,
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 }
          });
        });
      } else {
        // Link directly from previous question (for non-multiple choice)
        const prevQuestionId = `question_${questionIndex}`;
        links.push({
          id: `${prevQuestionId}_to_${questionNodeId}`,
          type: 'link',
          sourceNodeId: prevQuestionId,
          targetNodeId: questionNodeId,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 }
        });
      }
    }
    
    // Create parent-child links from question to its choices
    choiceNodes.forEach(choiceNode => {
      links.push({
        id: `${questionNodeId}_to_${choiceNode.id}`,
        type: 'parent-child',
        sourceNodeId: questionNodeId,
        targetNodeId: choiceNode.id,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 }
      });
    });
    
    // Create links from choices to next question or end
    const nextQuestionId = questionIndex < quiz.questions.length - 1 
      ? `question_${questionIndex + 2}` 
      : 'end';
    
    if (choiceNodes.length > 0) {
      choiceNodes.forEach(choiceNode => {
        links.push({
          id: `${choiceNode.id}_to_${nextQuestionId}`,
          type: 'link',
          sourceNodeId: choiceNode.id,
          targetNodeId: nextQuestionId,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 0, y: 0 }
        });
      });
    } else {
      // If this question has no choices, link directly to next question
      links.push({
        id: `${questionNodeId}_to_${nextQuestionId}`,
        type: 'link',
        sourceNodeId: questionNodeId,
        targetNodeId: nextQuestionId,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 }
      });
    }
    
    // Minimal logging for link creation
    if (choiceNodes.length === 0) {
      debugLog('Trivie Converter', `Question ${questionIndex + 1} has no choices, creating direct link`);
    }
  });
  
  // Create the NLJ scenario
  const scenario: NLJScenario = {
    id: quiz.id,
    name: quiz.title,
    orientation: 'horizontal',
    activityType: 'training',
    nodes,
    links,
    variableDefinitions: [{
      id: 'score',
      name: 'Score',
      type: 'integer'
    }]
  };
  
  debugLog('Trivie Converter', `Successfully converted quiz: ${quiz.questions.length} questions, ${nodes.length} nodes, ${links.length} links`);
  
  return scenario;
}

/**
 * Validate Trivie quiz format
 */
export function validateTrivieQuiz(quiz: TrivieQuiz): string[] {
  const errors: string[] = [];
  
  if (!quiz.id) errors.push('Quiz ID is required');
  if (!quiz.title) errors.push('Quiz title is required');
  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push('Quiz must have at least one question');
  }
  
  quiz.questions.forEach((question, index) => {
    if (!question.id) errors.push(`Question ${index + 1}: ID is required`);
    if (!question.question) errors.push(`Question ${index + 1}: Question text is required`);
    if (!question.type) errors.push(`Question ${index + 1}: Question type is required`);
    
    if (question.type === 'multiple_choice' && (!question.choices || question.choices.length < 2)) {
      errors.push(`Question ${index + 1}: Multiple choice questions need at least 2 choices`);
    }
    
    if (question.choices && question.choices.length > 0) {
      const hasCorrectAnswer = question.choices.some(c => c.isCorrect);
      if (!hasCorrectAnswer) {
        errors.push(`Question ${index + 1}: Must have at least one correct answer`);
      }
    }
  });
  
  return errors;
}