/**
 * Schema Documentation Generator for LLM Prompt System
 * Extracts and formats node type documentation from the NLJ schema
 */

// Schema Documentation Generator for LLM Prompt System
// Extracts and formats node type documentation from the NLJ schema

// Node type metadata for documentation
export interface NodeTypeDocumentation {
  nodeType: string;
  displayName: string;
  description: string;
  bloomsLevel: string[];
  category: 'structural' | 'question' | 'survey' | 'game' | 'choice';
  schemaExample: Record<string, unknown>;
  usageNotes: string[];
  commonProps: string[];
  specificProps: string[];
  validationRules: string[];
  exampleUsage: string;
}

// Note: Bloom's taxonomy levels and categories are embedded in the node schemas below

// Common properties shared by all nodes
const COMMON_NODE_PROPS = [
  'id', 'type', 'x', 'y', 'width', 'height', 
  'title', 'description', 'tags', 'metadata',
  'validation', 'theme', 'accessibility'
];

// Node type schemas with examples
const NODE_SCHEMAS: Record<string, NodeTypeDocumentation> = {
  start: {
    nodeType: 'start',
    displayName: 'Start Node',
    description: 'Entry point for the scenario. Displays welcome message and start button.',
    bloomsLevel: ['Structure'],
    category: 'structural',
    schemaExample: {
      id: 'start',
      type: 'start',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      title: 'Welcome to Training',
      description: 'Click Start to begin your learning journey.'
    },
    usageNotes: [
      'Every scenario must have exactly one start node',
      'Start nodes do not require user interaction',
      'Automatically proceeds to next node when clicked'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: [],
    validationRules: [
      'Must have unique id',
      'Must have type: "start"',
      'Must have valid x, y, width, height coordinates'
    ],
    exampleUsage: 'Use as the entry point for training scenarios, surveys, or assessments.'
  },
  
  end: {
    nodeType: 'end',
    displayName: 'End Node',
    description: 'Completion point for the scenario. Shows final message and results.',
    bloomsLevel: ['Structure'],
    category: 'structural',
    schemaExample: {
      id: 'end',
      type: 'end',
      x: 800,
      y: 100,
      width: 200,
      height: 100,
      title: 'Congratulations!',
      description: 'You have completed the training.'
    },
    usageNotes: [
      'Every scenario should have at least one end node',
      'Can have multiple end nodes for different completion paths',
      'Automatically shows completion screen and results'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: [],
    validationRules: [
      'Must have unique id',
      'Must have type: "end"',
      'Must have valid coordinates'
    ],
    exampleUsage: 'Use to conclude scenarios and show completion status.'
  },
  
  interstitial_panel: {
    nodeType: 'interstitial_panel',
    displayName: 'Interstitial Panel',
    description: 'Information display node for content between questions.',
    bloomsLevel: ['Structure'],
    category: 'structural',
    schemaExample: {
      id: 'info-panel',
      type: 'interstitial_panel',
      x: 400,
      y: 200,
      width: 400,
      height: 300,
      text: 'Important Information',
      content: 'This section covers safety procedures...',
      media: {
        id: 'safety-video',
        type: 'VIDEO',
        fullPath: '/videos/safety-intro.mp4',
        title: 'Safety Introduction'
      }
    },
    usageNotes: [
      'Used for informational content between questions',
      'Supports markdown content and media',
      'Automatically shows Continue button'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media'],
    validationRules: [
      'Must have type: "interstitial_panel"',
      'Should have text or content property',
      'Media must follow Media interface if provided'
    ],
    exampleUsage: 'Use to provide context, instructions, or break up long sequences of questions.'
  },
  
  question: {
    nodeType: 'question',
    displayName: 'Multiple Choice Question',
    description: 'Multiple choice question with selectable options.',
    bloomsLevel: ['Remember', 'Understand', 'Apply'],
    category: 'question',
    schemaExample: {
      id: 'q1',
      type: 'question',
      x: 300,
      y: 200,
      width: 400,
      height: 300,
      text: 'What is the capital of France?',
      content: 'Select the correct answer from the options below.',
      media: {
        id: 'france-map',
        type: 'IMAGE',
        fullPath: '/images/france-map.jpg',
        title: 'Map of France'
      }
    },
    usageNotes: [
      'Requires associated ChoiceNode elements for options',
      'Links determine which choices are available',
      'Supports immediate feedback and scoring'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList'],
    validationRules: [
      'Must have type: "question"',
      'Must have text property',
      'Must have at least one choice node linked to it'
    ],
    exampleUsage: 'Use for knowledge checks, comprehension questions, and decision points.'
  },
  
  choice: {
    nodeType: 'choice',
    displayName: 'Choice Option',
    description: 'Individual choice option for multiple choice questions.',
    bloomsLevel: ['Structure'],
    category: 'choice',
    schemaExample: {
      id: 'choice1',
      type: 'choice',
      x: 500,
      y: 100,
      width: 300,
      height: 80,
      text: 'Paris',
      isCorrect: true,
      feedback: 'Correct! Paris is the capital of France.',
      choiceType: 'CORRECT'
    },
    usageNotes: [
      'Used as answer options for multiple choice questions',
      'Must be connected to question node via parent-child links',
      'Each choice should have navigation links to next node',
      'Feedback is displayed after selection'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'isCorrect', 'feedback', 'choiceType', 'variableChanges'],
    validationRules: [
      'Must have type: "choice"',
      'Must have text property',
      'Should have isCorrect boolean property',
      'Should have feedback property',
      'Must be linked from a question node via parent-child link'
    ],
    exampleUsage: 'Use as answer options for multiple choice questions with immediate feedback.'
  },
  
  true_false: {
    nodeType: 'true_false',
    displayName: 'True/False Question',
    description: 'Binary choice question with true/false answers.',
    bloomsLevel: ['Remember', 'Understand'],
    category: 'question',
    schemaExample: {
      id: 'tf1',
      type: 'true_false',
      x: 300,
      y: 200,
      width: 400,
      height: 250,
      text: 'Paris is the capital of France.',
      content: 'Determine if this statement is true or false.',
      correctAnswer: true,
      media: {
        id: 'paris-image',
        type: 'IMAGE',
        fullPath: '/images/paris.jpg',
        title: 'Paris cityscape'
      }
    },
    usageNotes: [
      'Simple binary choice format',
      'Built-in validation against correctAnswer',
      'Supports immediate feedback'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'correctAnswer'],
    validationRules: [
      'Must have type: "true_false"',
      'Must have text property',
      'Must have correctAnswer boolean property'
    ],
    exampleUsage: 'Use for fact verification, concept validation, and simple assessments.'
  },
  
  ordering: {
    nodeType: 'ordering',
    displayName: 'Ordering Question',
    description: 'Drag-and-drop question for sequencing items, ranking priorities, or arranging by importance.',
    bloomsLevel: ['Understand', 'Apply', 'Analyze'],
    category: 'question',
    schemaExample: {
      id: 'order1',
      type: 'ordering',
      x: 300,
      y: 200,
      width: 400,
      height: 350,
      text: 'Put these steps in the correct order:',
      content: 'Arrange the car maintenance steps in proper sequence.',
      items: [
        {
          id: 'step1',
          text: 'Check oil level',
          correctOrder: 1
        },
        {
          id: 'step2',
          text: 'Start engine',
          correctOrder: 2
        },
        {
          id: 'step3',
          text: 'Turn off engine',
          correctOrder: 3
        }
      ]
    },
    usageNotes: [
      'Drag-and-drop interface for reordering',
      'Validates against correctOrder property', 
      'Supports partial credit scoring',
      'Ideal for ranking items by priority, importance, or sequence'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'items'],
    validationRules: [
      'Must have type: "ordering"',
      'Must have text property',
      'Must have items array with correctOrder values'
    ],
    exampleUsage: 'Use for process sequences, chronological ordering, procedural training, priority ranking, and importance evaluation.'
  },
  
  matching: {
    nodeType: 'matching',
    displayName: 'Matching Question',
    description: 'Connect items from two columns by drawing lines.',
    bloomsLevel: ['Remember', 'Understand', 'Apply'],
    category: 'question',
    schemaExample: {
      id: 'match1',
      type: 'matching',
      x: 300,
      y: 200,
      width: 500,
      height: 400,
      text: 'Match each term with its definition:',
      content: 'Click to connect related items.',
      leftItems: [
        { id: 'term1', text: 'Engine' },
        { id: 'term2', text: 'Brake' }
      ],
      rightItems: [
        { id: 'def1', text: 'Stops the vehicle' },
        { id: 'def2', text: 'Powers the vehicle' }
      ],
      correctMatches: [
        { leftId: 'term1', rightId: 'def2' },
        { leftId: 'term2', rightId: 'def1' }
      ]
    },
    usageNotes: [
      'Click-to-connect interface',
      'Visual feedback for connections',
      'Validates against correctMatches array'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'leftItems', 'rightItems', 'correctMatches'],
    validationRules: [
      'Must have type: "matching"',
      'Must have text property',
      'Must have leftItems and rightItems arrays',
      'Must have correctMatches array'
    ],
    exampleUsage: 'Use for vocabulary matching, concept relationships, and association learning.'
  },
  
  short_answer: {
    nodeType: 'short_answer',
    displayName: 'Short Answer Question',
    description: 'Text input question with multiple acceptable answers.',
    bloomsLevel: ['Remember', 'Understand', 'Apply'],
    category: 'question',
    schemaExample: {
      id: 'sa1',
      type: 'short_answer',
      x: 300,
      y: 200,
      width: 400,
      height: 250,
      text: 'What is the capital of France?',
      content: 'Enter your answer in the text field below.',
      correctAnswers: ['Paris', 'paris', 'PARIS'],
      caseSensitive: false
    },
    usageNotes: [
      'Text input field for user responses',
      'Supports multiple correct answers',
      'Configurable case sensitivity'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'correctAnswers', 'caseSensitive'],
    validationRules: [
      'Must have type: "short_answer"',
      'Must have text property',
      'Must have correctAnswers array'
    ],
    exampleUsage: 'Use for knowledge recall, fill-in-the-blank, and open-ended questions.'
  },
  
  likert_scale: {
    nodeType: 'likert_scale',
    displayName: 'Likert Scale Question',
    description: 'Rating scale question for measuring attitudes or opinions.',
    bloomsLevel: ['Evaluate'],
    category: 'survey',
    schemaExample: {
      id: 'likert1',
      type: 'likert_scale',
      x: 300,
      y: 200,
      width: 500,
      height: 300,
      text: 'How satisfied are you with your job?',
      content: 'Please rate your satisfaction level.',
      scale: {
        min: 1,
        max: 5,
        step: 1,
        labels: {
          min: 'Very Dissatisfied',
          max: 'Very Satisfied',
          middle: 'Neutral'
        }
      },
      required: true,
      showNumbers: true
    },
    usageNotes: [
      'Scale-based response system',
      'Configurable range and labels',
      'Commonly used in surveys and feedback'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'scale', 'defaultValue', 'required', 'showNumbers', 'showLabels'],
    validationRules: [
      'Must have type: "likert_scale"',
      'Must have text property',
      'Must have scale object with min, max, and labels'
    ],
    exampleUsage: 'Use for opinion surveys, satisfaction ratings, and attitude measurements.'
  },
  
  rating: {
    nodeType: 'rating',
    displayName: 'Rating Question',
    description: 'Star, numeric, or categorical rating question.',
    bloomsLevel: ['Evaluate'],
    category: 'survey',
    schemaExample: {
      id: 'rating1',
      type: 'rating',
      x: 300,
      y: 200,
      width: 400,
      height: 250,
      text: 'Rate your overall experience:',
      content: 'Click the stars to rate your experience.',
      ratingType: 'stars',
      range: {
        min: 1,
        max: 5
      },
      allowHalf: true,
      showValue: true,
      required: true
    },
    usageNotes: [
      'Multiple rating types: stars, numeric, categorical',
      'Supports half-star ratings',
      'Visual feedback for selections'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'ratingType', 'range', 'categories', 'defaultValue', 'required', 'allowHalf', 'showValue', 'icons'],
    validationRules: [
      'Must have type: "rating"',
      'Must have text property',
      'Must have ratingType and range properties'
    ],
    exampleUsage: 'Use for experience ratings, quality assessments, and preference measurements.'
  },
  
  matrix: {
    nodeType: 'matrix',
    displayName: 'Matrix Question',
    description: 'Grid-based question with multiple criteria evaluation for each row item. Best for multi-dimensional assessments, not for ranking or prioritization.',
    bloomsLevel: ['Understand', 'Apply', 'Evaluate'],
    category: 'survey',
    schemaExample: {
      id: 'matrix1',
      type: 'matrix',
      x: 300,
      y: 200,
      width: 600,
      height: 400,
      text: 'How would you rate each department on the following criteria?',
      content: 'Rate each department from 1 (Poor) to 5 (Excellent)',
      rows: [
        { id: 'sales', text: 'Sales Department' },
        { id: 'support', text: 'Customer Support' },
        { id: 'engineering', text: 'Engineering' }
      ],
      columns: [
        { id: 'quality', text: 'Quality of Service' },
        { id: 'responsiveness', text: 'Responsiveness' },
        { id: 'knowledge', text: 'Knowledge' }
      ],
      scaleType: 'numeric',
      scaleRange: { min: 1, max: 5 },
      required: true
    },
    usageNotes: [
      'Grid-based layout with rows and columns',
      'Each cell can have different response types',
      'Supports numeric scales, ratings, and text responses',
      'Responsive design adapts to screen size',
      'NOT for ranking or prioritization - use ordering node type instead'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'rows', 'columns', 'scaleType', 'scaleRange', 'matrixType', 'allowPartialResponse', 'required'],
    validationRules: [
      'Must have type: "matrix"',
      'Must have text property',
      'Must have rows and columns arrays',
      'ScaleType must be valid (numeric, rating, text) OR use matrixType property',
      'Supports both scaleType/scaleRange and matrixType patterns'
    ],
    exampleUsage: 'Use for multi-dimensional evaluations, department ratings, and comparative assessments. For ranking/prioritization tasks, use ordering node type instead.'
  },
  
  slider: {
    nodeType: 'slider',
    displayName: 'Slider Question',
    description: 'Continuous scale input with draggable slider control.',
    bloomsLevel: ['Evaluate'],
    category: 'survey',
    schemaExample: {
      id: 'slider1',
      type: 'slider',
      x: 300,
      y: 200,
      width: 500,
      height: 250,
      text: 'How satisfied are you with your current work-life balance?',
      content: 'Move the slider to indicate your satisfaction level.',
      range: { min: 0, max: 100 },
      step: 5,
      defaultValue: 50,
      labels: {
        min: 'Very Dissatisfied',
        max: 'Very Satisfied',
        current: 'Current: {value}%'
      },
      showValue: true,
      required: true
    },
    usageNotes: [
      'Continuous scale with smooth interaction',
      'Configurable range and step increments',
      'Visual feedback with current value display',
      'Supports custom labels and formatting'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'range', 'step', 'defaultValue', 'labels', 'showValue', 'required'],
    validationRules: [
      'Must have type: "slider"',
      'Must have text property',
      'Must have range object with min and max values',
      'Step must be positive number'
    ],
    exampleUsage: 'Use for satisfaction ratings, probability assessments, and continuous scale measurements.'
  },
  
  text_area: {
    nodeType: 'text_area',
    displayName: 'Text Area Question',
    description: 'Multi-line text input for long-form responses.',
    bloomsLevel: ['Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
    category: 'survey',
    schemaExample: {
      id: 'textarea1',
      type: 'text_area',
      x: 300,
      y: 200,
      width: 500,
      height: 350,
      text: 'Please describe your experience with our customer service.',
      content: 'Provide detailed feedback about your interactions.',
      placeholder: 'Enter your detailed response here...',
      minLength: 10,
      maxLength: 500,
      rows: 6,
      required: true,
      showCharacterCount: true
    },
    usageNotes: [
      'Multi-line text input with validation',
      'Configurable length limits and character counting',
      'Supports placeholder text and formatting',
      'Automatic text area resizing options'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'placeholder', 'minLength', 'maxLength', 'rows', 'required', 'showCharacterCount'],
    validationRules: [
      'Must have type: "text_area"',
      'Must have text property',
      'MinLength and maxLength must be positive numbers',
      'Rows must be positive integer'
    ],
    exampleUsage: 'Use for detailed feedback, essay questions, and open-ended responses.'
  },
  
  multi_select: {
    nodeType: 'multi_select',
    displayName: 'Multi-Select Question',
    description: 'Multiple choice question allowing selection of multiple options.',
    bloomsLevel: ['Remember', 'Understand', 'Apply'],
    category: 'survey',
    schemaExample: {
      id: 'multiselect1',
      type: 'multi_select',
      x: 300,
      y: 200,
      width: 450,
      height: 400,
      text: 'Which of the following programming languages do you use?',
      content: 'Select all that apply.',
      options: [
        { id: 'js', text: 'JavaScript', value: 'javascript' },
        { id: 'py', text: 'Python', value: 'python' },
        { id: 'java', text: 'Java', value: 'java' },
        { id: 'cpp', text: 'C++', value: 'cpp' },
        { id: 'go', text: 'Go', value: 'go' }
      ],
      minSelections: 1,
      maxSelections: 3,
      required: true
    },
    usageNotes: [
      'Allow multiple option selection with checkboxes',
      'Configurable minimum and maximum selections',
      'Validation for selection limits',
      'Supports custom option values'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'options', 'minSelections', 'maxSelections', 'required'],
    validationRules: [
      'Must have type: "multi_select"',
      'Must have text property',
      'Must have options array with at least one option',
      'MinSelections and maxSelections must be positive numbers'
    ],
    exampleUsage: 'Use for skills assessment, preference selection, and multi-option surveys.'
  },
  
  checkbox: {
    nodeType: 'checkbox',
    displayName: 'Checkbox Question',
    description: 'Quiz-style multi-select question with correct/incorrect answers.',
    bloomsLevel: ['Remember', 'Understand', 'Apply'],
    category: 'question',
    schemaExample: {
      id: 'checkbox1',
      type: 'checkbox',
      x: 300,
      y: 200,
      width: 450,
      height: 400,
      text: 'Which of the following are programming languages?',
      content: 'Select all correct answers.',
      options: [
        { id: 'js', text: 'JavaScript', isCorrect: true },
        { id: 'py', text: 'Python', isCorrect: true },
        { id: 'html', text: 'HTML', isCorrect: false },
        { id: 'css', text: 'CSS', isCorrect: false }
      ],
      minSelections: 1,
      maxSelections: 4,
      feedback: {
        correct: 'Excellent! You identified the programming languages correctly.',
        incorrect: 'Not quite. JavaScript and Python are programming languages, while HTML and CSS are markup and styling languages.'
      }
    },
    usageNotes: [
      'Allow multiple option selection with scoring',
      'Each option has isCorrect boolean flag',
      'Validation for selection limits',
      'Provides immediate feedback on correctness'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'options', 'minSelections', 'maxSelections', 'feedback'],
    validationRules: [
      'Must have type: "checkbox"',
      'Must have text property',
      'Must have options array with at least one option',
      'Each option must have isCorrect boolean property',
      'MinSelections and maxSelections must be positive numbers'
    ],
    exampleUsage: 'Use for knowledge checks, comprehension questions, and multi-answer assessments.'
  },
  
  connections: {
    nodeType: 'connections',
    displayName: 'Connections Game',
    description: 'NYT-style word puzzle game for finding groups of related words.',
    bloomsLevel: ['Analyze', 'Understand'],
    category: 'game',
    schemaExample: {
      id: 'connections1',
      type: 'connections',
      x: 300,
      y: 200,
      width: 600,
      height: 500,
      text: 'Find groups of four words that share something in common.',
      content: 'Categories are ordered by difficulty: yellow (easiest) to purple (hardest).',
      gameData: {
        title: 'Word Connections',
        instructions: 'Find groups of four items that share something in common.',
        groups: [
          {
            category: 'Dog Breeds',
            words: ['BEAGLE', 'POODLE', 'BOXER', 'HUSKY'],
            difficulty: 'yellow'
          },
          {
            category: 'Coffee Types',
            words: ['LATTE', 'MOCHA', 'ESPRESSO', 'CAPPUCCINO'],
            difficulty: 'green'
          },
          {
            category: 'Things That Are Round',
            words: ['BALL', 'WHEEL', 'COIN', 'PLATE'],
            difficulty: 'blue'
          },
          {
            category: 'Words That Can Follow Fire',
            words: ['WORKS', 'PLACE', 'TRUCK', 'ALARM'],
            difficulty: 'purple'
          }
        ]
      },
      scoring: {
        correctGroupPoints: 10,
        completionBonus: 20,
        mistakePenalty: 2
      }
    },
    usageNotes: [
      'Interactive word puzzle game',
      'Four groups of four words each',
      'Difficulty-based color coding',
      'Mistake tracking and scoring'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'gameData', 'scoring', 'timeLimit', 'required'],
    validationRules: [
      'Must have type: "connections"',
      'Must have text property',
      'Must have gameData with exactly 4 groups',
      'Each group must have exactly 4 words'
    ],
    exampleUsage: 'Use for vocabulary building, categorization skills, and analytical thinking.'
  },

  crossword: {
    nodeType: 'crossword',
    displayName: 'Mini Crossword',
    description: 'Interactive crossword puzzle with real-time validation and hints.',
    bloomsLevel: ['Remember', 'Apply', 'Analyze'],
    category: 'game',
    schemaExample: {
      id: 'crossword1',
      type: 'crossword',
      x: 300,
      y: 200,
      width: 800,
      height: 600,
      text: 'Complete the Mini Crossword',
      content: 'Solve this crossword puzzle by filling in all the correct answers.',
      gameSettings: {
        gridSize: { width: 5, height: 5 },
        showErrors: true,
        allowPartialSubmit: false,
        difficultyLevel: 'easy',
        grid: [
          [
            { letter: "", isBlocked: true },
            { letter: "C", number: 1, isBlocked: false },
            { letter: "O", isBlocked: false },
            { letter: "D", isBlocked: false },
            { letter: "E", isBlocked: false }
          ],
          [
            { letter: "D", number: 2, isBlocked: false },
            { letter: "A", isBlocked: false },
            { letter: "T", isBlocked: false },
            { letter: "A", isBlocked: false },
            { letter: "", isBlocked: true }
          ]
        ],
        clues: [
          {
            number: 1,
            clue: "Programming instructions",
            answer: "CODE",
            startRow: 0,
            startCol: 1,
            direction: "across",
            length: 4
          },
          {
            number: 2,
            clue: "Information stored digitally",
            answer: "DATA",
            startRow: 1,
            startCol: 0,
            direction: "across",
            length: 4
          }
        ]
      },
      allowHints: true,
      scoring: {
        basePoints: 100,
        bonusPerCorrectWord: 20,
        hintPenalty: 5
      }
    },
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'gameSettings', 'allowHints', 'scoring'],
    usageNotes: [
      'Grid size should be 5x5, 7x7, or similar for mini crosswords',
      'Each clue must have corresponding grid placement data',
      'Blocked cells (isBlocked: true) have no letter content',
      'Number cells indicate the start of across/down words',
      'Answers should be uppercase in the grid definition'
    ],
    validationRules: [
      'Must have type: "crossword"',
      'Must have text property',
      'Must have gameSettings with grid and clues',
      'Grid dimensions must match gridSize',
      'Each clue must have valid startRow, startCol, and length',
      'Clue answers must fit within grid boundaries'
    ],
    exampleUsage: 'Use for vocabulary reinforcement, spelling practice, and knowledge testing in an engaging puzzle format.'
  },
  
  wordle: {
    nodeType: 'wordle',
    displayName: 'Wordle Game',
    description: 'Word guessing game with letter feedback.',
    bloomsLevel: ['Remember', 'Apply'],
    category: 'game',
    schemaExample: {
      id: 'wordle1',
      type: 'wordle',
      x: 300,
      y: 200,
      width: 500,
      height: 600,
      text: 'Guess the 5-letter word!',
      content: 'You have 6 attempts to guess the word.',
      gameData: {
        targetWord: 'HELLO',
        wordLength: 5,
        maxAttempts: 6,
        hints: ['It is a greeting']
      },
      hardMode: false,
      allowHints: true,
      scoring: {
        basePoints: 50,
        bonusPerRemainingAttempt: 10
      }
    },
    usageNotes: [
      'Word guessing with letter feedback',
      'Color-coded feedback system',
      'Supports hints and hard mode',
      'Comprehensive word validation'
    ],
    commonProps: COMMON_NODE_PROPS,
    specificProps: ['text', 'content', 'media', 'additionalMediaList', 'gameData', 'hardMode', 'showKeyboard', 'colorblindMode', 'allowHints', 'scoring'],
    validationRules: [
      'Must have type: "wordle"',
      'Must have text property',
      'Must have gameData with targetWord and wordLength'
    ],
    exampleUsage: 'Use for vocabulary practice, spelling reinforcement, and word recognition.'
  }
};

/**
 * Get documentation for a specific node type
 */
export function getNodeTypeDocumentation(nodeType: string): NodeTypeDocumentation | null {
  return NODE_SCHEMAS[nodeType] || null;
}

/**
 * Get all available node types with their documentation
 */
export function getAllNodeTypes(): NodeTypeDocumentation[] {
  return Object.values(NODE_SCHEMAS);
}

/**
 * Get node types by category
 */
export function getNodeTypesByCategory(category: NodeTypeDocumentation['category']): NodeTypeDocumentation[] {
  return Object.values(NODE_SCHEMAS).filter(node => node.category === category);
}

/**
 * Required structural nodes that should always be included in scenarios
 */
const REQUIRED_STRUCTURAL_NODES = ['start', 'end'] as const;

/**
 * Get optional node types by category (excluding required structural nodes)
 */
export function getOptionalNodeTypesByCategory(category: NodeTypeDocumentation['category']): NodeTypeDocumentation[] {
  return Object.values(NODE_SCHEMAS).filter(node => {
    if (node.category !== category) return false;
    if (category === 'structural' && REQUIRED_STRUCTURAL_NODES.includes(node.nodeType as any)) {
      return false;
    }
    return true;
  });
}

/**
 * Get node types by Bloom's taxonomy level
 */
export function getNodeTypesByBloomsLevel(level: string): NodeTypeDocumentation[] {
  return Object.values(NODE_SCHEMAS).filter(node => 
    node.bloomsLevel.includes(level)
  );
}

/**
 * Generate complete schema documentation as markdown
 */
export function generateSchemaDocumentation(): string {
  const nodeTypes = getAllNodeTypes();
  const categories = ['structural', 'question', 'survey', 'game', 'choice'] as const;
  
  let markdown = `# NLJ Schema Documentation

## Overview

The Non-Linear Journey (NLJ) schema supports ${nodeTypes.length} different node types for creating interactive training scenarios, surveys, assessments, and games.

## Node Categories

`;

  categories.forEach(category => {
    const categoryNodes = getNodeTypesByCategory(category);
    if (categoryNodes.length === 0) return;
    
    markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Nodes\n\n`;
    
    categoryNodes.forEach(node => {
      markdown += `#### ${node.displayName} (\`${node.nodeType}\`)\n\n`;
      markdown += `${node.description}\n\n`;
      markdown += `**Bloom's Taxonomy:** ${node.bloomsLevel.join(', ')}\n\n`;
      markdown += `**Usage Notes:**\n`;
      node.usageNotes.forEach(note => {
        markdown += `- ${note}\n`;
      });
      markdown += `\n`;
      
      markdown += `**Schema Example:**\n`;
      markdown += `\`\`\`json\n${JSON.stringify(node.schemaExample, null, 2)}\n\`\`\`\n\n`;
      
      markdown += `**Validation Rules:**\n`;
      node.validationRules.forEach(rule => {
        markdown += `- ${rule}\n`;
      });
      markdown += `\n`;
      
      markdown += `**Example Usage:** ${node.exampleUsage}\n\n`;
      markdown += `---\n\n`;
    });
  });
  
  return markdown;
}

/**
 * Generate Bloom's taxonomy reference
 */
export function generateBloomsTaxonomyReference(): string {
  const levels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
  
  let markdown = `# Bloom's Taxonomy Reference for NLJ Nodes\n\n`;
  
  levels.forEach(level => {
    const nodes = getNodeTypesByBloomsLevel(level);
    if (nodes.length === 0) return;
    
    markdown += `## ${level}\n\n`;
    markdown += `**Node Types:** ${nodes.map(n => n.displayName).join(', ')}\n\n`;
    markdown += `**Recommended Use Cases:**\n`;
    
    switch(level) {
      case 'Remember':
        markdown += `- Factual recall questions\n- Vocabulary definitions\n- Basic identification tasks\n\n`;
        break;
      case 'Understand':
        markdown += `- Concept explanations\n- Categorization exercises\n- Relationship identification\n\n`;
        break;
      case 'Apply':
        markdown += `- Procedure execution\n- Problem-solving scenarios\n- Skill demonstrations\n\n`;
        break;
      case 'Analyze':
        markdown += `- Component analysis\n- Pattern recognition\n- Cause-effect relationships\n\n`;
        break;
      case 'Evaluate':
        markdown += `- Quality assessments\n- Opinion surveys\n- Preference measurements\n\n`;
        break;
      case 'Create':
        markdown += `- Original content generation\n- Solution design\n- Synthesis tasks\n\n`;
        break;
    }
  });
  
  return markdown;
}

/**
 * Generate validation rules reference
 */
export function generateValidationReference(): string {
  let markdown = `# NLJ Validation Rules Reference\n\n`;
  
  markdown += `## Common Validation Rules\n\n`;
  markdown += `All nodes must include:\n`;
  COMMON_NODE_PROPS.forEach(prop => {
    markdown += `- \`${prop}\`: `;
    switch(prop) {
      case 'id':
        markdown += `Unique identifier string\n`;
        break;
      case 'type':
        markdown += `Node type from supported list\n`;
        break;
      case 'x':
      case 'y':
      case 'width':
      case 'height':
        markdown += `Numeric coordinate/dimension\n`;
        break;
      default:
        markdown += `Optional property\n`;
    }
  });
  
  markdown += `\n## Node-Specific Validation\n\n`;
  
  const nodeTypes = getAllNodeTypes();
  nodeTypes.forEach(node => {
    markdown += `### ${node.displayName}\n\n`;
    node.validationRules.forEach(rule => {
      markdown += `- ${rule}\n`;
    });
    markdown += `\n`;
  });
  
  return markdown;
}

/**
 * Extract example scenarios from sample files
 */
export function generateExampleScenarios(): string {
  return `# Example NLJ Scenarios

## Basic Training Scenario

\`\`\`json
{
  "id": "basic-training",
  "name": "Basic Training Example",
  "orientation": "horizontal",
  "activityType": "training",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 100
    },
    {
      "id": "q1",
      "type": "true_false",
      "x": 400,
      "y": 100,
      "width": 400,
      "height": 200,
      "text": "The Earth is round.",
      "correctAnswer": true
    },
    {
      "id": "end",
      "type": "end",
      "x": 800,
      "y": 100,
      "width": 200,
      "height": 100
    }
  ],
  "links": [
    {
      "id": "start-q1",
      "type": "link",
      "sourceNodeId": "start",
      "targetNodeId": "q1",
      "startPoint": { "x": 300, "y": 150 },
      "endPoint": { "x": 400, "y": 150 }
    },
    {
      "id": "q1-end",
      "type": "link",
      "sourceNodeId": "q1",
      "targetNodeId": "end",
      "startPoint": { "x": 800, "y": 150 },
      "endPoint": { "x": 800, "y": 150 }
    }
  ]
}
\`\`\`

## Multiple Choice Question Example

\`\`\`json
{
  "id": "multiple-choice-example",
  "name": "Multiple Choice Example",
  "orientation": "horizontal",
  "activityType": "training",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 100
    },
    {
      "id": "q1",
      "type": "question",
      "x": 400,
      "y": 100,
      "width": 400,
      "height": 200,
      "text": "What is the capital of France?",
      "content": "Select the correct answer from the options below."
    },
    {
      "id": "choice1",
      "type": "choice",
      "x": 500,
      "y": 50,
      "width": 200,
      "height": 60,
      "text": "Paris",
      "isCorrect": true,
      "feedback": "Correct! Paris is the capital of France."
    },
    {
      "id": "choice2",
      "type": "choice",
      "x": 500,
      "y": 120,
      "width": 200,
      "height": 60,
      "text": "London",
      "isCorrect": false,
      "feedback": "Incorrect. London is the capital of England."
    },
    {
      "id": "choice3",
      "type": "choice",
      "x": 500,
      "y": 190,
      "width": 200,
      "height": 60,
      "text": "Berlin",
      "isCorrect": false,
      "feedback": "Incorrect. Berlin is the capital of Germany."
    },
    {
      "id": "end",
      "type": "end",
      "x": 900,
      "y": 100,
      "width": 200,
      "height": 100
    }
  ],
  "links": [
    {
      "id": "start-q1",
      "type": "link",
      "sourceNodeId": "start",
      "targetNodeId": "q1",
      "startPoint": { "x": 300, "y": 150 },
      "endPoint": { "x": 400, "y": 150 }
    },
    {
      "id": "q1-choice1",
      "type": "parent-child",
      "sourceNodeId": "q1",
      "targetNodeId": "choice1",
      "startPoint": { "x": 600, "y": 100 },
      "endPoint": { "x": 600, "y": 80 }
    },
    {
      "id": "q1-choice2",
      "type": "parent-child",
      "sourceNodeId": "q1",
      "targetNodeId": "choice2",
      "startPoint": { "x": 600, "y": 150 },
      "endPoint": { "x": 600, "y": 150 }
    },
    {
      "id": "q1-choice3",
      "type": "parent-child",
      "sourceNodeId": "q1",
      "targetNodeId": "choice3",
      "startPoint": { "x": 600, "y": 200 },
      "endPoint": { "x": 600, "y": 220 }
    },
    {
      "id": "choice1-end",
      "type": "link",
      "sourceNodeId": "choice1",
      "targetNodeId": "end",
      "startPoint": { "x": 700, "y": 80 },
      "endPoint": { "x": 900, "y": 150 }
    },
    {
      "id": "choice2-end",
      "type": "link",
      "sourceNodeId": "choice2",
      "targetNodeId": "end",
      "startPoint": { "x": 700, "y": 150 },
      "endPoint": { "x": 900, "y": 150 }
    },
    {
      "id": "choice3-end",
      "type": "link",
      "sourceNodeId": "choice3",
      "targetNodeId": "end",
      "startPoint": { "x": 700, "y": 220 },
      "endPoint": { "x": 900, "y": 150 }
    }
  ]
}
\`\`\`

## Survey Scenario

\`\`\`json
{
  "id": "employee-survey",
  "name": "Employee Satisfaction Survey",
  "orientation": "vertical",
  "activityType": "survey",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 100
    },
    {
      "id": "satisfaction",
      "type": "likert_scale",
      "x": 100,
      "y": 300,
      "width": 500,
      "height": 200,
      "text": "How satisfied are you with your job?",
      "scale": {
        "min": 1,
        "max": 5,
        "labels": {
          "min": "Very Dissatisfied",
          "max": "Very Satisfied"
        }
      }
    },
    {
      "id": "end",
      "type": "end",
      "x": 100,
      "y": 600,
      "width": 200,
      "height": 100
    }
  ],
  "links": [
    {
      "id": "start-satisfaction",
      "type": "link",
      "sourceNodeId": "start",
      "targetNodeId": "satisfaction",
      "startPoint": { "x": 200, "y": 200 },
      "endPoint": { "x": 200, "y": 300 }
    },
    {
      "id": "satisfaction-end",
      "type": "link",
      "sourceNodeId": "satisfaction",
      "targetNodeId": "end",
      "startPoint": { "x": 200, "y": 500 },
      "endPoint": { "x": 200, "y": 600 }
    }
  ]
}
\`\`\`

## Game Scenario

\`\`\`json
{
  "id": "word-game",
  "name": "Word Learning Game",
  "orientation": "horizontal",
  "activityType": "game",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 100
    },
    {
      "id": "wordle1",
      "type": "wordle",
      "x": 400,
      "y": 100,
      "width": 500,
      "height": 600,
      "text": "Guess the 5-letter word!",
      "gameData": {
        "targetWord": "PLANT",
        "wordLength": 5,
        "maxAttempts": 6
      }
    },
    {
      "id": "end",
      "type": "end",
      "x": 1000,
      "y": 100,
      "width": 200,
      "height": 100
    }
  ],
  "links": [
    {
      "id": "start-wordle",
      "type": "link",
      "sourceNodeId": "start",
      "targetNodeId": "wordle1",
      "startPoint": { "x": 300, "y": 150 },
      "endPoint": { "x": 400, "y": 150 }
    },
    {
      "id": "wordle-end",
      "type": "link",
      "sourceNodeId": "wordle1",
      "targetNodeId": "end",
      "startPoint": { "x": 900, "y": 150 },
      "endPoint": { "x": 1000, "y": 150 }
    }
  ]
}
\`\`\`
`;
}