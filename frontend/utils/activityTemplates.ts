/**
 * Activity Templates for Create Activity Modal
 * Pre-defined templates for different activity types
 */

import React from 'react';
import {
  DesignServices as DesignServicesIcon,
  Poll as PollIcon,
  Quiz as QuizIcon,
  AccountTree as AccountTreeIcon,
  Games as GamesIcon,
} from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';

export interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactElement;
  category: 'blank' | 'survey' | 'assessment' | 'training' | 'game';
  template: NLJScenario;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
}

// Generate unique IDs for nodes
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Blank Canvas Template
const BLANK_TEMPLATE: NLJScenario = {
  id: 'template-blank',
  name: 'Blank Canvas',
  orientation: 'vertical',
  activityType: 'training',
  nodes: [
    {
      id: 'start',
      type: 'start',
      text: '<h2>Welcome</h2><p>Your activity begins here.</p>',
      x: 300, y: 50, width: 300, height: 100
    },
    {
      id: 'end',
      type: 'end',
      text: 'Activity Complete',
      x: 300, y: 250, width: 300, height: 80
    }
  ],
  links: [
    { type: 'link', sourceNodeId: 'start', targetNodeId: 'end' }
  ]
};

// Survey Template
const SURVEY_TEMPLATE: NLJScenario = {
  id: 'template-survey',
  name: 'Survey Template',
  orientation: 'vertical',
  activityType: 'survey',
  nodes: [
    {
      id: 'start',
      type: 'start',
      text: '<h2>Welcome to Our Survey</h2><p>Your feedback helps us improve our services. This should take about 5-10 minutes to complete.</p>',
      x: 300, y: 50, width: 400, height: 120
    },
    {
      id: 'demographics',
      type: 'interstitial_panel',
      content: '<h3>About You</h3><p>Please tell us a bit about yourself to help us understand our audience better.</p>',
      x: 300, y: 200, width: 400, height: 100
    },
    {
      id: 'q1_role',
      type: 'question',
      text: 'What is your primary role?',
      questionType: 'multipleChoice',
      isRequired: true,
      x: 300, y: 330, width: 400, height: 180
    },
    {
      id: 'choice1_manager',
      type: 'choice',
      text: 'Manager/Supervisor',
      isCorrect: false,
      x: 100, y: 540, width: 180, height: 60
    },
    {
      id: 'choice1_employee',
      type: 'choice', 
      text: 'Individual Contributor',
      isCorrect: false,
      x: 320, y: 540, width: 180, height: 60
    },
    {
      id: 'choice1_other',
      type: 'choice',
      text: 'Other',
      isCorrect: false,
      x: 540, y: 540, width: 180, height: 60
    },
    {
      id: 'satisfaction_section',
      type: 'panel',
      text: '<h3>Satisfaction Survey</h3><p>Please rate your experience with various aspects of our organization.</p>',
      x: 300, y: 650, width: 400, height: 100
    },
    {
      id: 'q_likert_1',
      type: 'likert_scale',
      text: 'How satisfied are you with your current work environment?',
      scaleType: '1-5',
      lowLabel: 'Very Dissatisfied',
      highLabel: 'Very Satisfied',
      isRequired: true,
      x: 300, y: 780, width: 400, height: 150
    },
    {
      id: 'q_likert_2',
      type: 'likert_scale',
      text: 'How would you rate the communication from leadership?',
      scaleType: '1-5',
      lowLabel: 'Poor',
      highLabel: 'Excellent',
      isRequired: true,
      x: 300, y: 960, width: 400, height: 150
    },
    {
      id: 'matrix_question',
      type: 'matrix',
      text: 'Please rate the following aspects of our organization:',
      rows: [
        { id: 'quality', text: 'Work Quality Standards' },
        { id: 'communication', text: 'Internal Communication' },
        { id: 'resources', text: 'Available Resources' },
        { id: 'support', text: 'Management Support' }
      ],
      columns: [
        { id: 'poor', text: 'Poor' },
        { id: 'fair', text: 'Fair' },
        { id: 'good', text: 'Good' },
        { id: 'excellent', text: 'Excellent' }
      ],
      matrixType: 'single',
      required: true,
      x: 300, y: 1140, width: 500, height: 200
    },
    {
      id: 'open_feedback',
      type: 'text_area',
      text: 'Please share any additional feedback or suggestions:',
      placeholder: 'Your thoughts and suggestions are valuable to us...',
      maxLength: 1000,
      rows: 4,
      required: false,
      x: 300, y: 1370, width: 400, height: 150
    },
    {
      id: 'thank_you',
      type: 'panel',
      text: '<h3>Thank You!</h3><p>Your responses have been recorded. We appreciate you taking the time to provide feedback.</p><p>Your input helps us create a better workplace for everyone.</p>',
      x: 300, y: 1550, width: 400, height: 120
    },
    {
      id: 'end',
      type: 'end',
      text: 'Survey Complete',
      x: 300, y: 1700, width: 300, height: 80
    }
  ],
  links: [
    { type: 'link', sourceNodeId: 'start', targetNodeId: 'demographics' },
    { type: 'link', sourceNodeId: 'demographics', targetNodeId: 'q1_role' },
    { type: 'parent-child', sourceNodeId: 'q1_role', targetNodeId: 'choice1_manager' },
    { type: 'parent-child', sourceNodeId: 'q1_role', targetNodeId: 'choice1_employee' },
    { type: 'parent-child', sourceNodeId: 'q1_role', targetNodeId: 'choice1_other' },
    { type: 'link', sourceNodeId: 'choice1_manager', targetNodeId: 'satisfaction_section' },
    { type: 'link', sourceNodeId: 'choice1_employee', targetNodeId: 'satisfaction_section' },
    { type: 'link', sourceNodeId: 'choice1_other', targetNodeId: 'satisfaction_section' },
    { type: 'link', sourceNodeId: 'satisfaction_section', targetNodeId: 'q_likert_1' },
    { type: 'link', sourceNodeId: 'q_likert_1', targetNodeId: 'q_likert_2' },
    { type: 'link', sourceNodeId: 'q_likert_2', targetNodeId: 'matrix_question' },
    { type: 'link', sourceNodeId: 'matrix_question', targetNodeId: 'open_feedback' },
    { type: 'link', sourceNodeId: 'open_feedback', targetNodeId: 'thank_you' },
    { type: 'link', sourceNodeId: 'thank_you', targetNodeId: 'end' }
  ]
};

// Assessment Template
const ASSESSMENT_TEMPLATE: NLJScenario = {
  id: 'template-assessment',
  name: 'Assessment Template',
  orientation: 'vertical',
  activityType: 'assessment',
  nodes: [
    {
      id: 'start',
      type: 'start',
      text: '<h2>Knowledge Assessment</h2><p>Test your understanding with this quiz. Good luck!</p>',
      x: 300, y: 50, width: 400, height: 120
    },
    {
      id: 'instructions',
      type: 'panel',
      text: '<h3>Instructions</h3><ul><li>Answer all questions to the best of your ability</li><li>You have 30 minutes to complete this assessment</li><li>Choose the best answer for each multiple choice question</li><li>Your score will be calculated automatically</li></ul>',
      x: 300, y: 200, width: 400, height: 160
    },
    {
      id: 'q1',
      type: 'question',
      text: 'Sample multiple choice question - What is the primary purpose of this assessment?',
      questionType: 'multipleChoice',
      isRequired: true,
      x: 300, y: 390, width: 400, height: 180
    },
    {
      id: 'q1_choice1',
      type: 'choice',
      text: 'To test knowledge retention',
      isCorrect: true,
      x: 100, y: 600, width: 180, height: 60
    },
    {
      id: 'q1_choice2',
      type: 'choice',
      text: 'To waste time',
      isCorrect: false,
      x: 320, y: 600, width: 180, height: 60
    },
    {
      id: 'q1_choice3',
      type: 'choice',
      text: 'To confuse learners',
      isCorrect: false,
      x: 540, y: 600, width: 180, height: 60
    },
    {
      id: 'q2',
      type: 'true_false',
      text: 'True or False: Assessments are an important part of the learning process.',
      correctAnswer: true,
      isRequired: true,
      x: 300, y: 710, width: 400, height: 120
    },
    {
      id: 'q3',
      type: 'short_answer',
      text: 'In your own words, describe one benefit of taking assessments:',
      answerValidation: {
        type: 'minLength',
        value: 10
      },
      isRequired: true,
      x: 300, y: 860, width: 400, height: 150
    },
    {
      id: 'results',
      type: 'panel',
      text: '<h3>Assessment Complete</h3><p><strong>Your Performance:</strong></p><p>Score: <span id="user-score">[SCORE]</span> out of <span id="max-score">[TOTAL]</span></p><p>Percentage: <span id="percentage">[PERCENTAGE]%</span></p><div id="performance-feedback"><p>Great job completing the assessment!</p></div>',
      x: 300, y: 1040, width: 400, height: 160
    },
    {
      id: 'end',
      type: 'end',
      text: 'Assessment Complete',
      x: 300, y: 1230, width: 300, height: 80
    }
  ],
  links: [
    { type: 'link', sourceNodeId: 'start', targetNodeId: 'instructions' },
    { type: 'link', sourceNodeId: 'instructions', targetNodeId: 'q1' },
    { type: 'parent-child', sourceNodeId: 'q1', targetNodeId: 'q1_choice1' },
    { type: 'parent-child', sourceNodeId: 'q1', targetNodeId: 'q1_choice2' },
    { type: 'parent-child', sourceNodeId: 'q1', targetNodeId: 'q1_choice3' },
    { type: 'link', sourceNodeId: 'q1_choice1', targetNodeId: 'q2' },
    { type: 'link', sourceNodeId: 'q1_choice2', targetNodeId: 'q2' },
    { type: 'link', sourceNodeId: 'q1_choice3', targetNodeId: 'q2' },
    { type: 'link', sourceNodeId: 'q2', targetNodeId: 'q3' },
    { type: 'link', sourceNodeId: 'q3', targetNodeId: 'results' },
    { type: 'link', sourceNodeId: 'results', targetNodeId: 'end' }
  ],
  variableDefinitions: [
    { id: 'score', name: 'Total Score', type: 'integer' },
    { id: 'maxScore', name: 'Maximum Score', type: 'integer' },
    { id: 'percentage', name: 'Score Percentage', type: 'decimal' }
  ]
};

// Training (Non-Linear Journey) Template
const TRAINING_TEMPLATE: NLJScenario = {
  id: 'template-training',
  name: 'Training Template',
  orientation: 'vertical', 
  activityType: 'training',
  nodes: [
    {
      id: 'start',
      type: 'start',
      text: '<h2>Interactive Training Scenario</h2><p>Navigate through this training by making decisions that reflect real-world situations.</p>',
      x: 300, y: 50, width: 400, height: 120
    },
    {
      id: 'scenario_setup',
      type: 'panel',
      text: '<h3>Scenario</h3><p>You are faced with a challenging situation that requires careful consideration. The choices you make will influence the outcome.</p><p><strong>Context:</strong> You need to make an important decision that will affect your team and project.</p>',
      x: 300, y: 200, width: 400, height: 140
    },
    {
      id: 'decision_point',
      type: 'question',
      text: 'What is your first course of action?',
      questionType: 'multipleChoice',
      isRequired: true,
      x: 300, y: 370, width: 400, height: 160
    },
    {
      id: 'choice_consult',
      type: 'choice',
      text: 'Consult with team members',
      isCorrect: false,
      x: 50, y: 560, width: 200, height: 80
    },
    {
      id: 'choice_research',
      type: 'choice',
      text: 'Research the issue further',
      isCorrect: false,
      x: 300, y: 560, width: 200, height: 80
    },
    {
      id: 'choice_decide',
      type: 'choice',
      text: 'Make a quick decision',
      isCorrect: false,
      x: 550, y: 560, width: 200, height: 80
    },
    {
      id: 'outcome_consult',
      type: 'panel',
      text: '<h3>Team Consultation Path</h3><p>You decided to consult with your team members. This collaborative approach has several benefits...</p><p><strong>Result:</strong> Your team feels valued and provides valuable insights.</p>',
      x: 50, y: 680, width: 300, height: 140
    },
    {
      id: 'outcome_research',
      type: 'panel',
      text: '<h3>Research Path</h3><p>You chose to gather more information before proceeding. This methodical approach helps you understand the situation better...</p><p><strong>Result:</strong> You discover important details that influence your strategy.</p>',
      x: 400, y: 680, width: 300, height: 140
    },
    {
      id: 'outcome_quick',
      type: 'panel',
      text: '<h3>Quick Decision Path</h3><p>You opted for a swift decision. Sometimes quick action is necessary, but it comes with certain trade-offs...</p><p><strong>Result:</strong> You move forward quickly but may have missed important considerations.</p>',
      x: 750, y: 680, width: 300, height: 140
    },
    {
      id: 'reflection',
      type: 'panel',
      text: '<h3>Reflection</h3><p>Consider the path you chose and its outcomes. In real situations:</p><ul><li>Each approach has merits depending on the context</li><li>The best leaders adapt their style to the situation</li><li>Learning from each decision improves future choices</li></ul>',
      x: 300, y: 860, width: 400, height: 160
    },
    {
      id: 'end',
      type: 'end',
      text: 'Training Complete',
      x: 300, y: 1050, width: 300, height: 80
    }
  ],
  links: [
    { type: 'link', sourceNodeId: 'start', targetNodeId: 'scenario_setup' },
    { type: 'link', sourceNodeId: 'scenario_setup', targetNodeId: 'decision_point' },
    { type: 'parent-child', sourceNodeId: 'decision_point', targetNodeId: 'choice_consult' },
    { type: 'parent-child', sourceNodeId: 'decision_point', targetNodeId: 'choice_research' },
    { type: 'parent-child', sourceNodeId: 'decision_point', targetNodeId: 'choice_decide' },
    { type: 'link', sourceNodeId: 'choice_consult', targetNodeId: 'outcome_consult' },
    { type: 'link', sourceNodeId: 'choice_research', targetNodeId: 'outcome_research' },
    { type: 'link', sourceNodeId: 'choice_decide', targetNodeId: 'outcome_quick' },
    { type: 'link', sourceNodeId: 'outcome_consult', targetNodeId: 'reflection' },
    { type: 'link', sourceNodeId: 'outcome_research', targetNodeId: 'reflection' },
    { type: 'link', sourceNodeId: 'outcome_quick', targetNodeId: 'reflection' },
    { type: 'link', sourceNodeId: 'reflection', targetNodeId: 'end' }
  ]
};

// Game Template
const GAME_TEMPLATE: NLJScenario = {
  id: 'template-game',
  name: 'Game Template',
  orientation: 'vertical',
  activityType: 'game',
  nodes: [
    {
      id: 'start',
      type: 'start',
      text: '<h2>Interactive Learning Games</h2><p>Challenge yourself with fun, engaging games that reinforce learning concepts.</p>',
      x: 300, y: 50, width: 400, height: 120
    },
    {
      id: 'game_intro',
      type: 'panel',
      text: '<h3>Game Instructions</h3><p>You will play a series of interactive games designed to test and reinforce your knowledge.</p><p><strong>Tips:</strong></p><ul><li>Take your time to think through each challenge</li><li>Learn from mistakes - they are part of the process</li><li>Have fun while learning!</li></ul>',
      x: 300, y: 200, width: 400, height: 160
    },
    {
      id: 'connections_game',
      type: 'connections',
      text: 'Group these words into categories of 4. Find the connections!',
      words: [
        'Apple', 'Banana', 'Car', 'Truck',
        'Red', 'Blue', 'Cat', 'Dog', 
        'Guitar', 'Piano', 'Green', 'Yellow',
        'Bus', 'Train', 'Violin', 'Drums'
      ],
      categories: [
        { name: 'Fruits', items: ['Apple', 'Banana'], difficulty: 1 },
        { name: 'Vehicles', items: ['Car', 'Truck', 'Bus', 'Train'], difficulty: 2 },
        { name: 'Colors', items: ['Red', 'Blue', 'Green', 'Yellow'], difficulty: 3 },
        { name: 'Animals', items: ['Cat', 'Dog'], difficulty: 1 },
        { name: 'Instruments', items: ['Guitar', 'Piano', 'Violin', 'Drums'], difficulty: 4 }
      ],
      maxMistakes: 4,
      x: 300, y: 390, width: 500, height: 300
    },
    {
      id: 'wordle_game',
      type: 'wordle',
      text: 'Guess the 5-letter word! You have 6 attempts.',
      targetWord: 'LEARN',
      maxAttempts: 6,
      wordLength: 5,
      showHints: true,
      x: 300, y: 720, width: 400, height: 300
    },
    {
      id: 'game_results',
      type: 'panel',
      text: '<h3>Game Complete!</h3><p>Congratulations on completing the learning games!</p><p><strong>What you accomplished:</strong></p><ul><li>Exercised pattern recognition skills</li><li>Practiced logical thinking</li><li>Engaged with content in a fun, interactive way</li></ul><p>Games like these help reinforce learning through active engagement.</p>',
      x: 300, y: 1050, width: 400, height: 180
    },
    {
      id: 'end',
      type: 'end',
      text: 'Games Complete',
      x: 300, y: 1260, width: 300, height: 80
    }
  ],
  links: [
    { type: 'link', sourceNodeId: 'start', targetNodeId: 'game_intro' },
    { type: 'link', sourceNodeId: 'game_intro', targetNodeId: 'connections_game' },
    { type: 'link', sourceNodeId: 'connections_game', targetNodeId: 'wordle_game' },
    { type: 'link', sourceNodeId: 'wordle_game', targetNodeId: 'game_results' },
    { type: 'link', sourceNodeId: 'game_results', targetNodeId: 'end' }
  ]
};

// Export all activity templates
export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with a blank flow',
    icon: React.createElement(DesignServicesIcon),
    category: 'blank',
    template: BLANK_TEMPLATE,
    color: 'primary'
  },
  {
    id: 'survey',
    name: 'Survey',
    description: 'Collect feedback with surveys and questionnaires',
    icon: React.createElement(PollIcon),
    category: 'survey',
    template: SURVEY_TEMPLATE,
    color: 'info'
  },
  {
    id: 'assessment',
    name: 'Assessment',
    description: 'Test knowledge with scored assessments',
    icon: React.createElement(QuizIcon),
    category: 'assessment', 
    template: ASSESSMENT_TEMPLATE,
    color: 'success'
  },
  {
    id: 'training',
    name: 'Training Scenario',
    description: 'Create interactive training with multiple paths',
    icon: React.createElement(AccountTreeIcon),
    category: 'training',
    template: TRAINING_TEMPLATE,
    color: 'warning'
  },
  {
    id: 'game',
    name: 'Interactive Game',
    description: 'Engage learners with interactive games',
    icon: React.createElement(GamesIcon),
    category: 'game',
    template: GAME_TEMPLATE,
    color: 'secondary'
  }
];