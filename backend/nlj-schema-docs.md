# NLJ Schema Documentation

## Overview

The Non-Linear Journey (NLJ) schema supports 19 different node types for creating interactive training scenarios, surveys, assessments, and games.

## Node Categories

### Structural Nodes

#### Start Node (`start`)

Entry point for the scenario. Displays welcome message and start button.

**Bloom's Taxonomy:** Structure

**Usage Notes:**
- Every scenario must have exactly one start node
- Start nodes do not require user interaction
- Automatically proceeds to next node when clicked

**Schema Example:**
```json
{
  "id": "start",
  "type": "start",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 100,
  "title": "Welcome to Training",
  "description": "Click Start to begin your learning journey."
}
```

**Validation Rules:**
- Must have unique id
- Must have type: "start"
- Must have valid x, y, width, height coordinates

**Example Usage:** Use as the entry point for training scenarios, surveys, or assessments.

---

#### End Node (`end`)

Completion point for the scenario. Shows final message and results.

**Bloom's Taxonomy:** Structure

**Usage Notes:**
- Every scenario should have at least one end node
- Can have multiple end nodes for different completion paths
- Automatically shows completion screen and results

**Schema Example:**
```json
{
  "id": "end",
  "type": "end",
  "x": 800,
  "y": 100,
  "width": 200,
  "height": 100,
  "title": "Congratulations!",
  "description": "You have completed the training."
}
```

**Validation Rules:**
- Must have unique id
- Must have type: "end"
- Must have valid coordinates

**Example Usage:** Use to conclude scenarios and show completion status.

---

#### Interstitial Panel (`interstitial_panel`)

Information display node for content between questions.

**Bloom's Taxonomy:** Structure

**Usage Notes:**
- Used for informational content between questions
- Supports markdown content and media
- Automatically shows Continue button

**Schema Example:**
```json
{
  "id": "info-panel",
  "type": "interstitial_panel",
  "x": 400,
  "y": 200,
  "width": 400,
  "height": 300,
  "text": "Important Information",
  "content": "This section covers safety procedures...",
  "media": {
    "id": "safety-video",
    "type": "VIDEO",
    "fullPath": "/videos/safety-intro.mp4",
    "title": "Safety Introduction"
  }
}
```

**Validation Rules:**
- Must have type: "interstitial_panel"
- Should have text or content property
- Media must follow Media interface if provided

**Example Usage:** Use to provide context, instructions, or break up long sequences of questions.

---

### Question Nodes

#### Multiple Choice Question (`question`)

Multiple choice question with selectable options.

**Bloom's Taxonomy:** Remember, Understand, Apply

**Usage Notes:**
- Requires associated ChoiceNode elements for options
- Links determine which choices are available
- Supports immediate feedback and scoring

**Schema Example:**
```json
{
  "id": "q1",
  "type": "question",
  "x": 300,
  "y": 200,
  "width": 400,
  "height": 300,
  "text": "What is the capital of France?",
  "content": "Select the correct answer from the options below.",
  "media": {
    "id": "france-map",
    "type": "IMAGE",
    "fullPath": "/images/france-map.jpg",
    "title": "Map of France"
  }
}
```

**Validation Rules:**
- Must have type: "question"
- Must have text property
- Must have at least one choice node linked to it

**Example Usage:** Use for knowledge checks, comprehension questions, and decision points.

---

#### True/False Question (`true_false`)

Binary choice question with true/false answers.

**Bloom's Taxonomy:** Remember, Understand

**Usage Notes:**
- Simple binary choice format
- Built-in validation against correctAnswer
- Supports immediate feedback

**Schema Example:**
```json
{
  "id": "tf1",
  "type": "true_false",
  "x": 300,
  "y": 200,
  "width": 400,
  "height": 250,
  "text": "Paris is the capital of France.",
  "content": "Determine if this statement is true or false.",
  "correctAnswer": true,
  "media": {
    "id": "paris-image",
    "type": "IMAGE",
    "fullPath": "/images/paris.jpg",
    "title": "Paris cityscape"
  }
}
```

**Validation Rules:**
- Must have type: "true_false"
- Must have text property
- Must have correctAnswer boolean property

**Example Usage:** Use for fact verification, concept validation, and simple assessments.

---

#### Ordering Question (`ordering`)

Drag-and-drop question for sequencing items, ranking priorities, or arranging by importance.

**Bloom's Taxonomy:** Understand, Apply, Analyze

**Usage Notes:**
- Drag-and-drop interface for reordering
- Validates against correctOrder property
- Supports partial credit scoring
- Ideal for ranking items by priority, importance, or sequence

**Schema Example:**
```json
{
  "id": "order1",
  "type": "ordering",
  "x": 300,
  "y": 200,
  "width": 400,
  "height": 350,
  "text": "Put these steps in the correct order:",
  "content": "Arrange the car maintenance steps in proper sequence.",
  "items": [
    {
      "id": "step1",
      "text": "Check oil level",
      "correctOrder": 1
    },
    {
      "id": "step2",
      "text": "Start engine",
      "correctOrder": 2
    },
    {
      "id": "step3",
      "text": "Turn off engine",
      "correctOrder": 3
    }
  ]
}
```

**Validation Rules:**
- Must have type: "ordering"
- Must have text property
- Must have items array with correctOrder values

**Example Usage:** Use for process sequences, chronological ordering, procedural training, priority ranking, and importance evaluation.

---

#### Matching Question (`matching`)

Connect items from two columns by drawing lines.

**Bloom's Taxonomy:** Remember, Understand, Apply

**Usage Notes:**
- Click-to-connect interface
- Visual feedback for connections
- Validates against correctMatches array

**Schema Example:**
```json
{
  "id": "match1",
  "type": "matching",
  "x": 300,
  "y": 200,
  "width": 500,
  "height": 400,
  "text": "Match each term with its definition:",
  "content": "Click to connect related items.",
  "leftItems": [
    {
      "id": "term1",
      "text": "Engine"
    },
    {
      "id": "term2",
      "text": "Brake"
    }
  ],
  "rightItems": [
    {
      "id": "def1",
      "text": "Stops the vehicle"
    },
    {
      "id": "def2",
      "text": "Powers the vehicle"
    }
  ],
  "correctMatches": [
    {
      "leftId": "term1",
      "rightId": "def2"
    },
    {
      "leftId": "term2",
      "rightId": "def1"
    }
  ]
}
```

**Validation Rules:**
- Must have type: "matching"
- Must have text property
- Must have leftItems and rightItems arrays
- Must have correctMatches array

**Example Usage:** Use for vocabulary matching, concept relationships, and association learning.

---

#### Short Answer Question (`short_answer`)

Text input question with multiple acceptable answers.

**Bloom's Taxonomy:** Remember, Understand, Apply

**Usage Notes:**
- Text input field for user responses
- Supports multiple correct answers
- Configurable case sensitivity

**Schema Example:**
```json
{
  "id": "sa1",
  "type": "short_answer",
  "x": 300,
  "y": 200,
  "width": 400,
  "height": 250,
  "text": "What is the capital of France?",
  "content": "Enter your answer in the text field below.",
  "correctAnswers": [
    "Paris",
    "paris",
    "PARIS"
  ],
  "caseSensitive": false
}
```

**Validation Rules:**
- Must have type: "short_answer"
- Must have text property
- Must have correctAnswers array

**Example Usage:** Use for knowledge recall, fill-in-the-blank, and open-ended questions.

---

#### Checkbox Question (`checkbox`)

Quiz-style multi-select question with correct/incorrect answers.

**Bloom's Taxonomy:** Remember, Understand, Apply

**Usage Notes:**
- Allow multiple option selection with scoring
- Each option has isCorrect boolean flag
- Validation for selection limits
- Provides immediate feedback on correctness

**Schema Example:**
```json
{
  "id": "checkbox1",
  "type": "checkbox",
  "x": 300,
  "y": 200,
  "width": 450,
  "height": 400,
  "text": "Which of the following are programming languages?",
  "content": "Select all correct answers.",
  "options": [
    {
      "id": "js",
      "text": "JavaScript",
      "isCorrect": true
    },
    {
      "id": "py",
      "text": "Python",
      "isCorrect": true
    },
    {
      "id": "html",
      "text": "HTML",
      "isCorrect": false
    },
    {
      "id": "css",
      "text": "CSS",
      "isCorrect": false
    }
  ],
  "minSelections": 1,
  "maxSelections": 4,
  "feedback": {
    "correct": "Excellent! You identified the programming languages correctly.",
    "incorrect": "Not quite. JavaScript and Python are programming languages, while HTML and CSS are markup and styling languages."
  }
}
```

**Validation Rules:**
- Must have type: "checkbox"
- Must have text property
- Must have options array with at least one option
- Each option must have isCorrect boolean property
- MinSelections and maxSelections must be positive numbers

**Example Usage:** Use for knowledge checks, comprehension questions, and multi-answer assessments.

---

### Survey Nodes

#### Likert Scale Question (`likert_scale`)

Rating scale question for measuring attitudes or opinions.

**Bloom's Taxonomy:** Evaluate

**Usage Notes:**
- Scale-based response system
- Configurable range and labels
- Commonly used in surveys and feedback

**Schema Example:**
```json
{
  "id": "likert1",
  "type": "likert_scale",
  "x": 300,
  "y": 200,
  "width": 500,
  "height": 300,
  "text": "How satisfied are you with your job?",
  "content": "Please rate your satisfaction level.",
  "scale": {
    "min": 1,
    "max": 5,
    "step": 1,
    "labels": {
      "min": "Very Dissatisfied",
      "max": "Very Satisfied",
      "middle": "Neutral"
    }
  },
  "required": true,
  "showNumbers": true
}
```

**Validation Rules:**
- Must have type: "likert_scale"
- Must have text property
- Must have scale object with min, max, and labels

**Example Usage:** Use for opinion surveys, satisfaction ratings, and attitude measurements.

---

#### Rating Question (`rating`)

Star, numeric, or categorical rating question.

**Bloom's Taxonomy:** Evaluate

**Usage Notes:**
- Multiple rating types: stars, numeric, categorical
- Supports half-star ratings
- Visual feedback for selections

**Schema Example:**
```json
{
  "id": "rating1",
  "type": "rating",
  "x": 300,
  "y": 200,
  "width": 400,
  "height": 250,
  "text": "Rate your overall experience:",
  "content": "Click the stars to rate your experience.",
  "ratingType": "stars",
  "range": {
    "min": 1,
    "max": 5
  },
  "allowHalf": true,
  "showValue": true,
  "required": true
}
```

**Validation Rules:**
- Must have type: "rating"
- Must have text property
- Must have ratingType and range properties

**Example Usage:** Use for experience ratings, quality assessments, and preference measurements.

---

#### Matrix Question (`matrix`)

Grid-based question with multiple criteria evaluation for each row item. Best for multi-dimensional assessments, not for ranking or prioritization.

**Bloom's Taxonomy:** Understand, Apply, Evaluate

**Usage Notes:**
- Grid-based layout with rows and columns
- Each cell can have different response types
- Supports numeric scales, ratings, and text responses
- Responsive design adapts to screen size
- NOT for ranking or prioritization - use ordering node type instead

**Schema Example:**
```json
{
  "id": "matrix1",
  "type": "matrix",
  "x": 300,
  "y": 200,
  "width": 600,
  "height": 400,
  "text": "How would you rate each department on the following criteria?",
  "content": "Rate each department from 1 (Poor) to 5 (Excellent)",
  "rows": [
    {
      "id": "sales",
      "text": "Sales Department"
    },
    {
      "id": "support",
      "text": "Customer Support"
    },
    {
      "id": "engineering",
      "text": "Engineering"
    }
  ],
  "columns": [
    {
      "id": "quality",
      "text": "Quality of Service"
    },
    {
      "id": "responsiveness",
      "text": "Responsiveness"
    },
    {
      "id": "knowledge",
      "text": "Knowledge"
    }
  ],
  "scaleType": "numeric",
  "scaleRange": {
    "min": 1,
    "max": 5
  },
  "required": true
}
```

**Validation Rules:**
- Must have type: "matrix"
- Must have text property
- Must have rows and columns arrays
- ScaleType must be valid (numeric, rating, text) OR use matrixType property
- Supports both scaleType/scaleRange and matrixType patterns

**Example Usage:** Use for multi-dimensional evaluations, department ratings, and comparative assessments. For ranking/prioritization tasks, use ordering node type instead.

---

#### Slider Question (`slider`)

Continuous scale input with draggable slider control.

**Bloom's Taxonomy:** Evaluate

**Usage Notes:**
- Continuous scale with smooth interaction
- Configurable range and step increments
- Visual feedback with current value display
- Supports custom labels and formatting

**Schema Example:**
```json
{
  "id": "slider1",
  "type": "slider",
  "x": 300,
  "y": 200,
  "width": 500,
  "height": 250,
  "text": "How satisfied are you with your current work-life balance?",
  "content": "Move the slider to indicate your satisfaction level.",
  "range": {
    "min": 0,
    "max": 100
  },
  "step": 5,
  "defaultValue": 50,
  "labels": {
    "min": "Very Dissatisfied",
    "max": "Very Satisfied",
    "current": "Current: {value}%"
  },
  "showValue": true,
  "required": true
}
```

**Validation Rules:**
- Must have type: "slider"
- Must have text property
- Must have range object with min and max values
- Step must be positive number

**Example Usage:** Use for satisfaction ratings, probability assessments, and continuous scale measurements.

---

#### Text Area Question (`text_area`)

Multi-line text input for long-form responses.

**Bloom's Taxonomy:** Understand, Apply, Analyze, Evaluate, Create

**Usage Notes:**
- Multi-line text input with validation
- Configurable length limits and character counting
- Supports placeholder text and formatting
- Automatic text area resizing options

**Schema Example:**
```json
{
  "id": "textarea1",
  "type": "text_area",
  "x": 300,
  "y": 200,
  "width": 500,
  "height": 350,
  "text": "Please describe your experience with our customer service.",
  "content": "Provide detailed feedback about your interactions.",
  "placeholder": "Enter your detailed response here...",
  "minLength": 10,
  "maxLength": 500,
  "rows": 6,
  "required": true,
  "showCharacterCount": true
}
```

**Validation Rules:**
- Must have type: "text_area"
- Must have text property
- MinLength and maxLength must be positive numbers
- Rows must be positive integer

**Example Usage:** Use for detailed feedback, essay questions, and open-ended responses.

---

#### Multi-Select Question (`multi_select`)

Multiple choice question allowing selection of multiple options.

**Bloom's Taxonomy:** Remember, Understand, Apply

**Usage Notes:**
- Allow multiple option selection with checkboxes
- Configurable minimum and maximum selections
- Validation for selection limits
- Supports custom option values

**Schema Example:**
```json
{
  "id": "multiselect1",
  "type": "multi_select",
  "x": 300,
  "y": 200,
  "width": 450,
  "height": 400,
  "text": "Which of the following programming languages do you use?",
  "content": "Select all that apply.",
  "options": [
    {
      "id": "js",
      "text": "JavaScript",
      "value": "javascript"
    },
    {
      "id": "py",
      "text": "Python",
      "value": "python"
    },
    {
      "id": "java",
      "text": "Java",
      "value": "java"
    },
    {
      "id": "cpp",
      "text": "C++",
      "value": "cpp"
    },
    {
      "id": "go",
      "text": "Go",
      "value": "go"
    }
  ],
  "minSelections": 1,
  "maxSelections": 3,
  "required": true
}
```

**Validation Rules:**
- Must have type: "multi_select"
- Must have text property
- Must have options array with at least one option
- MinSelections and maxSelections must be positive numbers

**Example Usage:** Use for skills assessment, preference selection, and multi-option surveys.

---

### Game Nodes

#### Connections Game (`connections`)

NYT-style word puzzle game for finding groups of related words.

**Bloom's Taxonomy:** Analyze, Understand

**Usage Notes:**
- Interactive word puzzle game
- Four groups of four words each
- Difficulty-based color coding (yellow=easiest, purple=hardest)
- Mistake tracking and scoring
- CRITICAL: Use gameData.groups structure, NOT categories/items arrays

**Schema Example:**
```json
{
  "id": "connections1",
  "type": "connections",
  "x": 300,
  "y": 200,
  "width": 600,
  "height": 500,
  "text": "Find groups of four words that share something in common.",
  "content": "Categories are ordered by difficulty: yellow (easiest) to purple (hardest).",
  "gameData": {
    "title": "Word Connections",
    "instructions": "Find groups of four items that share something in common.",
    "groups": [
      {
        "category": "Dog Breeds",
        "words": [
          "BEAGLE",
          "POODLE",
          "BOXER",
          "HUSKY"
        ],
        "difficulty": "yellow"
      },
      {
        "category": "Coffee Types",
        "words": [
          "LATTE",
          "MOCHA",
          "ESPRESSO",
          "CAPPUCCINO"
        ],
        "difficulty": "green"
      },
      {
        "category": "Things That Are Round",
        "words": [
          "BALL",
          "WHEEL",
          "COIN",
          "PLATE"
        ],
        "difficulty": "blue"
      },
      {
        "category": "Words That Can Follow Fire",
        "words": [
          "WORKS",
          "PLACE",
          "TRUCK",
          "ALARM"
        ],
        "difficulty": "purple"
      }
    ]
  },
  "scoring": {
    "correctGroupPoints": 10,
    "completionBonus": 20,
    "mistakePenalty": 2
  }
}
```

**Validation Rules:**
- Must have type: "connections"
- Must have text property
- Must have gameData object (NOT categories/items arrays)
- gameData must contain exactly 4 groups in an array
- Each group must have exactly 4 words in a words array
- Each group must have category, words, and difficulty properties
- Difficulty must be yellow, green, blue, OR purple

**Example Usage:** Use for vocabulary building, categorization skills, and analytical thinking.

---

#### Mini Crossword (`crossword`)

Interactive crossword puzzle with real-time validation and hints.

**Bloom's Taxonomy:** Remember, Apply, Analyze

**Usage Notes:**
- Grid size should be 5x5, 7x7, or similar for mini crosswords
- Each clue must have corresponding grid placement data
- Blocked cells (isBlocked: true) have no letter content
- Number cells indicate the start of across/down words
- Answers should be uppercase in the grid definition

**Schema Example:**
```json
{
  "id": "crossword1",
  "type": "crossword",
  "x": 300,
  "y": 200,
  "width": 800,
  "height": 600,
  "text": "Complete the Mini Crossword",
  "content": "Solve this crossword puzzle by filling in all the correct answers.",
  "gameSettings": {
    "gridSize": {
      "width": 5,
      "height": 5
    },
    "showErrors": true,
    "allowPartialSubmit": false,
    "difficultyLevel": "easy",
    "grid": [
      [
        {
          "letter": "",
          "isBlocked": true
        },
        {
          "letter": "C",
          "number": 1,
          "isBlocked": false
        },
        {
          "letter": "O",
          "isBlocked": false
        },
        {
          "letter": "D",
          "isBlocked": false
        },
        {
          "letter": "E",
          "isBlocked": false
        }
      ],
      [
        {
          "letter": "D",
          "number": 2,
          "isBlocked": false
        },
        {
          "letter": "A",
          "isBlocked": false
        },
        {
          "letter": "T",
          "isBlocked": false
        },
        {
          "letter": "A",
          "isBlocked": false
        },
        {
          "letter": "",
          "isBlocked": true
        }
      ]
    ],
    "clues": [
      {
        "number": 1,
        "clue": "Programming instructions",
        "answer": "CODE",
        "startRow": 0,
        "startCol": 1,
        "direction": "across",
        "length": 4
      },
      {
        "number": 2,
        "clue": "Information stored digitally",
        "answer": "DATA",
        "startRow": 1,
        "startCol": 0,
        "direction": "across",
        "length": 4
      }
    ]
  },
  "allowHints": true,
  "scoring": {
    "basePoints": 100,
    "bonusPerCorrectWord": 20,
    "hintPenalty": 5
  }
}
```

**Validation Rules:**
- Must have type: "crossword"
- Must have text property
- Must have gameSettings with grid and clues
- Grid dimensions must match gridSize
- Each clue must have valid startRow, startCol, and length
- Clue answers must fit within grid boundaries

**Example Usage:** Use for vocabulary reinforcement, spelling practice, and knowledge testing in an engaging puzzle format.

---

#### Wordle Game (`wordle`)

Word guessing game with letter feedback.

**Bloom's Taxonomy:** Remember, Apply

**Usage Notes:**
- Word guessing with letter feedback
- Color-coded feedback system
- Supports hints and hard mode
- Comprehensive word validation

**Schema Example:**
```json
{
  "id": "wordle1",
  "type": "wordle",
  "x": 300,
  "y": 200,
  "width": 500,
  "height": 600,
  "text": "Guess the 5-letter word!",
  "content": "You have 6 attempts to guess the word.",
  "gameData": {
    "targetWord": "HELLO",
    "wordLength": 5,
    "maxAttempts": 6,
    "hints": [
      "It is a greeting"
    ]
  },
  "hardMode": false,
  "allowHints": true,
  "scoring": {
    "basePoints": 50,
    "bonusPerRemainingAttempt": 10
  }
}
```

**Validation Rules:**
- Must have type: "wordle"
- Must have text property
- Must have gameData with targetWord and wordLength

**Example Usage:** Use for vocabulary practice, spelling reinforcement, and word recognition.

---

### Choice Nodes

#### Choice Option (`choice`)

Individual choice option for multiple choice questions.

**Bloom's Taxonomy:** Structure

**Usage Notes:**
- Used as answer options for multiple choice questions
- Must be connected to question node via parent-child links
- Each choice should have navigation links to next node
- Feedback is displayed after selection

**Schema Example:**
```json
{
  "id": "choice1",
  "type": "choice",
  "x": 500,
  "y": 100,
  "width": 300,
  "height": 80,
  "text": "Paris",
  "isCorrect": true,
  "feedback": "Correct! Paris is the capital of France.",
  "choiceType": "CORRECT"
}
```

**Validation Rules:**
- Must have type: "choice"
- Must have text property
- Should have isCorrect boolean property
- Should have feedback property
- Must be linked from a question node via parent-child link

**Example Usage:** Use as answer options for multiple choice questions with immediate feedback.

---

## Link Schema

Links connect nodes together to create the flow of the scenario. Each link must specify its type and connection points.

### Navigation Link (`link`)

Used for normal flow navigation between nodes.

**Schema Example:**
```json
{
  "id": "start-to-question1",
  "type": "link",
  "sourceNodeId": "start",
  "targetNodeId": "question1"
}
```

**Properties:**
- `id`: Unique identifier for the link
- `type`: Must be "link" for navigation links
- `sourceNodeId`: ID of the source node
- `targetNodeId`: ID of the target node

### Parent-Child Link (`parent-child`)

Used to connect question nodes to their choice nodes.

**Schema Example:**
```json
{
  "id": "question1-to-choice1",
  "type": "parent-child",
  "sourceNodeId": "question1",
  "targetNodeId": "choice1"
}
```

**Properties:**
- `id`: Unique identifier for the link
- `type`: Must be "parent-child" for question-choice relationships
- `sourceNodeId`: ID of the question node
- `targetNodeId`: ID of the choice node

**Critical Link Requirements:**
- ALL links must have a `type` property set to either "link" or "parent-child"
- Navigation links use `type: "link"`
- Question-to-choice connections use `type: "parent-child"`
- Choice-to-next-node connections use `type: "link"`

