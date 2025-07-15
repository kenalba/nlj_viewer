import * as XLSX from 'xlsx';
import type { NLJScenario, NLJNode, Link, ChoiceNode, QuestionNode, TrueFalseNode, OrderingNode, MatchingNode, ShortAnswerNode } from '../types/nlj';
import { debugLog } from './debug';

// Trivie quiz structure (inferred from common quiz formats)
export interface TrivieQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
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
      
      debugLog('Trivie Parser', `Processing sheet: ${sheetName}`, {
        rows: jsonData.length,
        firstRow: jsonData[0],
        secondRow: jsonData[1],
        thirdRow: jsonData[2]
      });

      // Try to interpret the sheet data as a quiz
      const quiz = parseSheetAsQuiz(sheetName, jsonData as any[][]);
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
function parseSheetAsQuiz(sheetName: string, data: any[][]): TrivieQuiz | null {
  if (!data || data.length < 2) return null;

  try {
    // Assume first row contains headers
    const headers = data[0] as string[];
    const rows = data.slice(1);
    
    debugLog('Trivie Parser', `Sheet data structure for ${sheetName}`, {
      totalRows: data.length,
      headers: headers,
      firstDataRow: rows[0],
      secondDataRow: rows[1]
    });

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

      debugLog('Trivie Parser', `Processing row ${questionId}`, {
        rowData: row.map((cell, idx) => `[${idx}]: ${cell}`),
        questionText: row[columnMap.question],
        questionType: columnMap.questionType ? row[columnMap.questionType] : 'unknown',
        answer1: row[columnMap.choiceA],
        answer2: row[columnMap.choiceB],
        correctChoices: row[columnMap.correctAnswer]
      });

      const question: TrivieQuestion = {
        id: `q${questionId}`,
        question: String(row[columnMap.question]).trim(),
        type: 'multiple_choice',
        choices: [],
        correctAnswer: columnMap.correctAnswer ? String(row[columnMap.correctAnswer] || '') : '',
        explanation: columnMap.explanation ? String(row[columnMap.explanation] || '') : '',
        difficulty: columnMap.difficulty ? String(row[columnMap.difficulty] || 'medium') as any : 'medium',
        category: columnMap.category ? String(row[columnMap.category] || '') : '',
        points: columnMap.points ? Number(row[columnMap.points]) || 1 : 1
      };

      // Parse choices (assuming they might be in separate columns or comma-separated)
      const choices = parseChoices(row, columnMap);
      question.choices = choices;
      
      debugLog('Trivie Parser', `Question ${questionId} parsed`, {
        question: question.question,
        choicesCount: choices.length,
        choices: choices.map(c => ({ text: c.text, isCorrect: c.isCorrect }))
      });

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
    if (h === 'answer_1') {
      mapping.choiceA = index;
      debugLog('Trivie Parser', 'Found answer_1 column', { index, header });
    }
    if (h === 'answer_2') {
      mapping.choiceB = index;
      debugLog('Trivie Parser', 'Found answer_2 column', { index, header });
    }
    if (h === 'answer_3') {
      mapping.choiceC = index;
      debugLog('Trivie Parser', 'Found answer_3 column', { index, header });
    }
    if (h === 'answer_4') {
      mapping.choiceD = index;
      debugLog('Trivie Parser', 'Found answer_4 column', { index, header });
    }
    
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
    headers: headers.map((h, i) => `[${i}]: ${h}`),
    mapping,
    choiceAIndex: mapping.choiceA,
    choiceBIndex: mapping.choiceB,
    choiceCIndex: mapping.choiceC,
    choiceDIndex: mapping.choiceD,
    correctAnswerIndex: mapping.correctAnswer
  });

  return mapping;
}

/**
 * Parse choices from row data
 */
function parseChoices(row: any[], columnMap: Record<string, number>): TrivieChoice[] {
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
  const choiceLabels = ['A', 'B', 'C', 'D'];
  
  for (let i = 0; i < choiceColumns.length; i++) {
    const columnIndex = columnMap[choiceColumns[i]];
    debugLog('Trivie Parser', `Checking choice ${choiceLabels[i]}`, {
      choiceColumn: choiceColumns[i],
      columnIndex,
      rowValue: columnIndex !== undefined ? row[columnIndex] : 'undefined',
      hasValue: columnIndex !== undefined && row[columnIndex]
    });
    
    if (columnIndex !== undefined && row[columnIndex]) {
      const choiceText = String(row[columnIndex]).trim();
      if (choiceText) {
        const isCorrect = correctAnswers.has(choiceLabels[i]) || correctAnswers.has(String(i + 1));
        
        debugLog('Trivie Parser', `Creating choice ${choiceLabels[i]}`, {
          choiceText,
          isCorrect,
          correctAnswers: Array.from(correctAnswers)
        });
        
        choices.push({
          id: `choice_${choiceLabels[i].toLowerCase()}`,
          text: choiceText,
          isCorrect
        });
      }
    }
  }
  
  debugLog('Trivie Parser', 'Parsed choices result', {
    choicesCount: choices.length,
    correctAnswers: Array.from(correctAnswers),
    choices: choices.map(c => ({ text: c.text, isCorrect: c.isCorrect })),
    columnMapChoices: {
      choiceA: columnMap.choiceA,
      choiceB: columnMap.choiceB,
      choiceC: columnMap.choiceC,
      choiceD: columnMap.choiceD
    },
    actualChoiceValues: {
      choiceA: columnMap.choiceA !== undefined ? row[columnMap.choiceA] : 'undefined',
      choiceB: columnMap.choiceB !== undefined ? row[columnMap.choiceB] : 'undefined',
      choiceC: columnMap.choiceC !== undefined ? row[columnMap.choiceC] : 'undefined',
      choiceD: columnMap.choiceD !== undefined ? row[columnMap.choiceD] : 'undefined'
    }
  });
  
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
    
    // Create question node
    const questionNode: QuestionNode = {
      id: questionNodeId,
      type: 'question',
      text: question.question,
      content: question.explanation || '',
      x: 200 + (questionIndex * 300),
      y: 200,
      width: 200,
      height: 100,
      additionalMediaList: []
    };
    nodes.push(questionNode);
    
    // Create choice nodes
    const choiceNodes: ChoiceNode[] = [];
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
    
    allChoiceNodes.push(choiceNodes);
    
    debugLog('Trivie Converter', `Created nodes for question ${questionIndex + 1}`, {
      questionNodeId,
      choiceNodesCount: choiceNodes.length,
      choiceNodeIds: choiceNodes.map(c => c.id)
    });
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
  quiz.questions.forEach((question, questionIndex) => {
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
      // Link from previous question choices to this question
      const prevChoiceNodes = allChoiceNodes[questionIndex - 1];
      if (prevChoiceNodes.length > 0) {
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
        // If previous question had no choices, link directly from previous question
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
    
    debugLog('Trivie Converter', `Created links for question ${questionIndex + 1}`, {
      questionNodeId,
      choiceNodesCount: choiceNodes.length,
      nextQuestionId,
      parentChildLinks: choiceNodes.length,
      choiceToNextLinks: choiceNodes.length > 0 ? choiceNodes.length : 1
    });
  });
  
  // Create the NLJ scenario
  const scenario: NLJScenario = {
    id: quiz.id,
    name: quiz.title,
    orientation: 'horizontal',
    nodes,
    links,
    variableDefinitions: [{
      id: 'score',
      name: 'Score',
      type: 'integer'
    }]
  };
  
  debugLog('Trivie Converter', 'Converted Trivie quiz to NLJ', {
    quizId: quiz.id,
    questionsCount: quiz.questions.length,
    nodesCount: nodes.length,
    linksCount: links.length,
    links: links.map(l => `${l.sourceNodeId} -> ${l.targetNodeId}`)
  });
  
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