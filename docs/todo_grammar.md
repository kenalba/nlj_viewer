# Journey Explorer: Node Grammar Extensions Roadmap

## 🎯 Vision

Extend Journey Explorer to be the universal activity player that can interpret and render any learning interaction type through a flexible, extensible node grammar system.

## 📋 Product Roadmap

### **Phase 1: Fill-in-the-Blank & Classification (2-3 weeks)**

**Goal**: Extend existing patterns with minimal schema disruption

#### **1.0 Question Feedback System**

- **Effort**: Medium (new modal system + backend integration)
- **Value**: Very High (quality improvement + user engagement)

**Components**:

- Flag icon in question result screens (correct/incorrect states)
- Report Question modal with predefined feedback options
- Text input for detailed feedback when "Something else" selected
- Feedback submission and confirmation system
- Integration with existing question node components

**Schema Enhancement**:

```typescript
interface QuestionFeedback {
  questionId: string;
  feedbackType: "incorrect_answers" | "unclear_question" | "other";
  feedbackText?: string;
  timestamp: string;
  userId?: string;
  scenarioId: string;
}

interface QuestionNodeFeedback {
  enableFeedback?: boolean;
  feedbackOptions?: string[]; // custom feedback options
  feedbackEndpoint?: string; // where to send feedback
}
```

**UI Enhancement**:

```typescript
// Add to all question node components
interface FeedbackModal {
  isOpen: boolean;
  selectedFeedback?: "incorrect_answers" | "unclear_question" | "other";
  customFeedbackText?: string;
  onSubmit: (feedback: QuestionFeedback) => void;
  onCancel: () => void;
}
```

#### **1.1 LLM Prompt Generation Feature**

- **Effort**: Small (UI addition to ScenarioLoader)
- **Value**: Very High (enables content creation workflow)

**Components**:

- Add "Generate Content Prompt" button to ScenarioLoader
- Prompt customization modal with persona, objective, style, complexity
- Download comprehensive prompt file with all current node type documentation
- Integration with existing sample JSON download functionality

**UI Enhancement**:

```typescript
// Add to ScenarioLoader component
interface PromptGenerationModal {
  audiencePersona: string;
  learningObjective: string;
  contentStyle: "conversational" | "formal" | "gamified" | "scenario_based";
  complexityLevel: number; // 1-10 slider
  bloomsLevels: string[];
  includeMediaPlaceholders: boolean;
}
```

#### **1.1 Fill-in-the-Blank Node**

- **Bloom's Level**: Knowledge/Comprehension
- **Effort**: Small (extend `short_answer` pattern)
- **Value**: High (very common learning pattern)

**Schema Addition**:

```typescript
interface FillInBlankNode extends BaseNode {
  type: "fill_in_blank";
  template: string; // "The capital of France is _____ and it has _____ million people."
  blanks: BlankDefinition[];
  validation: "exact" | "fuzzy" | "regex";
  caseSensitive?: boolean;
}

interface BlankDefinition {
  id: string;
  position: number; // which blank in sequence
  correctAnswers: string[];
  feedback?: {
    correct: string;
    incorrect: string;
    hint?: string;
  };
  points?: number;
}
```

**Component**: `FillInBlankNode.tsx`

- Parse template text, replace `_____` with input fields
- Real-time validation as user types
- Highlight correct/incorrect blanks
- Support for partial credit

#### **1.2 Classification Node**

- **Bloom's Level**: Analysis/Synthesis
- **Effort**: Medium (extend `ordering` drag logic)
- **Value**: High (categorization is core learning skill)

**Schema Addition**:

```typescript
interface ClassificationNode extends BaseNode {
  type: "classification";
  categories: CategoryDefinition[];
  items: ClassificationItem[];
  mode: "drag_drop" | "click_assign" | "multi_select";
  allowPartialCredit?: boolean;
  showCategoryHints?: boolean;
}

interface CategoryDefinition {
  id: string;
  label: string;
  description?: string;
  color?: string;
  maxItems?: number; // limit items per category
}

interface ClassificationItem {
  id: string;
  text: string;
  correctCategory: string;
  distractorCategories?: string[]; // common wrong answers
  media?: Media;
}
```

**Component**: `ClassificationNode.tsx`

- Multiple drop zones for categories
- Drag from central item pool
- Visual feedback for correct/incorrect placement
- Support for "None of the above" category

### **Phase 2: Interactive Visual Learning (3-4 weeks)**

**Goal**: Add new interaction paradigms for visual and spatial learning

#### **2.1 Hotspot Node**

- **Bloom's Level**: Application/Analysis
- **Effort**: Medium-Large (new interaction pattern)
- **Value**: Very High (visual learning, technical training)

**Schema Addition**:

```typescript
interface HotspotNode extends BaseNode {
  type: "hotspot";
  baseImage: Media;
  hotspots: HotspotDefinition[];
  mode: "click_all" | "click_sequence" | "single_choice" | "identify_label";
  showProgress?: boolean;
  allowRevisit?: boolean;
}

interface HotspotDefinition {
  id: string;
  shape: "circle" | "rectangle" | "polygon";
  coordinates: number[]; // [x, y] or [x, y, width, height] or polygon points
  label?: string;
  feedback: string;
  points?: number;
  sequencePosition?: number; // for sequential clicking
  hoverText?: string;
}
```

**Component**: `HotspotNode.tsx`

- SVG overlay on base image
- Responsive coordinate scaling
- Visual feedback for clicked regions
- Support for complex polygon shapes

#### **2.2 Memory Game Node**

- **Bloom's Level**: Knowledge/Comprehension
- **Effort**: Medium (well-defined game mechanics)
- **Value**: Medium-High (engagement, vocabulary building)

**Schema Addition**:

```typescript
interface MemoryGameNode extends BaseNode {
  type: "memory_game";
  gameType: "card_matching" | "sequence_repeat" | "concentration";
  cards: MemoryCard[];
  gridSize: { rows: number; cols: number };
  maxAttempts?: number;
  timeLimit?: number;
  showTimer?: boolean;
}

interface MemoryCard {
  id: string;
  front: string | Media;
  back: string | Media;
  matchId: string; // cards with same matchId are pairs
  difficulty?: "easy" | "medium" | "hard";
}
```

**Component**: `MemoryGameNode.tsx`

- Card flip animations
- Match validation logic
- Score tracking and timer
- Adaptive difficulty based on performance

### **Phase 3: Advanced Node Types (4-5 weeks)**

**Goal**: Add sophisticated interaction types for complex learning scenarios

#### **3.1 Sequence Node**

- **Effort**: Medium (extend ordering logic)
- **Value**: High (procedural learning)

**Schema Addition**:

```typescript
interface SequenceNode extends BaseNode {
  type: "sequence";
  steps: SequenceStep[];
  mode: "strict_order" | "flexible_order" | "timed_sequence";
  showProgress?: boolean;
  allowSkip?: boolean;
}

interface SequenceStep {
  id: string;
  title: string;
  description: string;
  media?: Media;
  duration?: number; // for timed sequences
  dependencies?: string[]; // prerequisite step IDs
}
```

#### **3.2 Branching Scenario Node**

- **Effort**: Large (complex decision trees)
- **Value**: Very High (decision-making training)

**Schema Addition**:

```typescript
interface BranchingScenarioNode extends BaseNode {
  type: "branching_scenario";
  situation: string;
  decisions: DecisionPoint[];
  outcomes: ScenarioOutcome[];
  trackingVariables?: string[];
}

interface DecisionPoint {
  id: string;
  prompt: string;
  options: DecisionOption[];
  timeLimit?: number;
}

interface DecisionOption {
  id: string;
  text: string;
  consequences: string[];
  nextDecisionId?: string;
  outcomeId?: string;
}
```

## 🏗️ Technical Architecture

### **Enhanced Node Grammar**

```typescript
// Extend base NLJNode interface
interface NLJNode extends BaseNode {
  // Core properties remain unchanged
  id: string;
  type: NodeType;
  text: string;
  media?: Media;

  // Enhanced interaction data
  interactionConfig?: InteractionConfiguration;

  // Enhanced validation system
  validation?: ValidationConfiguration;

  // Improved feedback system
  feedback?: FeedbackConfiguration;

  // Accessibility features
  accessibility?: AccessibilityConfiguration;
}

type NodeType =
  | "start"
  | "end"
  | "interstitial_panel"
  | "choice"
  | "question"
  | "true_false"
  | "ordering"
  | "matching"
  | "short_answer"
  | "connections"
  | "wordle"
  | "likert_scale"
  | "rating"
  | "matrix"
  | "slider"
  | "text_area"
  | "fill_in_blank"
  | "classification"
  | "hotspot"
  | "memory_game"
  | "sequence"
  | "branching_scenario";
```

### **Component Architecture**

```typescript
// Enhanced NodeRenderer with type safety
const NodeRenderer: React.FC<{ node: NLJNode }> = ({ node }) => {
  const components = {
    fill_in_blank: FillInBlankNode,
    classification: ClassificationNode,
    hotspot: HotspotNode,
    memory_game: MemoryGameNode,
    sequence: SequenceNode,
    branching_scenario: BranchingScenarioNode,
    // ... existing components
  };

  const Component = components[node.type];
  return <Component node={node} />;
};
```

## 📊 Success Metrics

### **Phase 1 KPIs**

- **Adoption**: % of new scenarios using fill-in-blank/classification
- **Engagement**: Completion rates vs. traditional question types
- **Effectiveness**: Learning outcomes on knowledge/comprehension tasks

### **Phase 2 KPIs**

- **Hotspot Usage**: Click accuracy rates, spatial learning effectiveness
- **Memory Games**: Completion rates, knowledge retention metrics
- **Visual Learning**: Performance on image-based assessments

### **Phase 3 KPIs**

- **Sequence Learning**: Completion rates on procedural tasks
- **Branching Scenarios**: Decision-making effectiveness metrics
- **Complex Interactions**: Performance on multi-step activities

## 🔧 Development Considerations

### **Performance Optimization**

- Lazy loading for complex interactions
- Image optimization for hotspot nodes
- Memory management for memory games

### **Mobile Responsiveness**

- Touch-friendly hotspot interactions
- Adaptive grid sizing for memory games
- Responsive drag-and-drop for classification

### **Accessibility**

- Keyboard navigation for all new node types
- Screen reader support for visual elements
- High contrast modes for visual interactions

### **Testing Strategy**

- Unit tests for each new node component
- Integration tests for complex interactions
- Performance testing for media-heavy nodes
- Accessibility testing with screen readers

## 🚀 Future Considerations

### **Advanced Features**

- **Performance Optimization**: Lazy loading and caching for complex nodes
- **Real-time Collaboration**: Multi-user interactions for group activities
- **Enhanced Analytics**: Detailed interaction tracking and performance metrics
- **Plugin Architecture**: Allow third-party node type extensions

### **Integration Opportunities**

- **LMS Integration**: Enhanced xAPI events for all new node types
- **Content Generation**: Seamless integration with external authoring tools
- **Assessment Engine**: Automated scoring and feedback systems
- **Mobile Apps**: Native mobile implementations for better performance

This roadmap positions Journey Explorer as the definitive universal activity player, focusing on robust JSON interpretation and extensible node grammar while maintaining clear separation from content generation concerns.
