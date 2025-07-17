# LLM-Powered Content Generation System

## 🎯 Vision

Create a prompt generation system that enables users to leverage Large Language Models (LLMs) to generate valid NLJ JSON scenarios. The system provides comprehensive prompts containing all node type specifications and examples, allowing users to combine their source material with our prompts to generate learning content.

## 🧠 Bloom's Taxonomy Integration Strategy

### **Cognitive Level Mapping**

The generated prompts will include guidance for creating activities at different Bloom's levels:

- **Remember**: Memory games, basic matching, simple multiple choice, true/false
- **Understand**: Classification, connections, explanatory questions with feedback
- **Apply**: Scenario-based questions, process simulations, short answer with examples
- **Analyze**: Hotspot identification, complex matching, multi-step ordering
- **Evaluate**: Rating scales, matrix questions comparing options, branching scenarios
- **Create**: Text areas for synthesis, open-ended problem solving, design tasks

## 📋 MVP Roadmap

### **Phase 1: Universal Prompt Generator (2-3 weeks)**

**Goal**: Create downloadable prompts that contain everything an LLM needs to generate valid NLJ JSON

#### **1.1 Complete Node Type Documentation**

- **Effort**: Medium (comprehensive documentation)
- **Value**: Critical (foundation for all LLM generation)

**Components**:

```typescript
interface NodeTypeDocumentation {
  nodeType: string;
  description: string;
  bloomsLevel: string[];
  schemaDefinition: object;
  validationRules: string[];
  exampleNode: object;
  commonUseCase: string;
  bestPractices: string[];
}
```

**Content Required**:

- Complete schema for all 18+ node types
- Validation rules and constraints
- Example nodes with realistic content
- Common pitfalls and how to avoid them
- Bloom's taxonomy alignment guidance

#### **1.2 Prompt Template Engine**

- **Effort**: Medium (template system)
- **Value**: High (customizable prompt generation)

**Features**:

- Dynamic prompt generation based on selected node types
- Bloom's taxonomy level targeting
- Content domain customization (automotive, healthcare, etc.)
- Difficulty level adjustment
- Scenario length preferences

#### **1.3 Example JSON Library**

- **Effort**: Small (curated examples)
- **Value**: Very High (concrete examples for LLMs)

**Example Categories**:

- **Basic Training**: Simple question sequences
- **Complex Scenarios**: Multi-path branching with variables
- **Assessment Suites**: Comprehensive testing scenarios
- **Survey Templates**: Employee feedback and evaluation
- **Game Collections**: Connections and Wordle examples

### **Phase 2: Interactive Prompt Builder (3-4 weeks)**

**Goal**: User-friendly interface for customizing prompts

#### **2.1 Prompt Customization Interface**

- **Effort**: Large (comprehensive UI)
- **Value**: High (user experience improvement)

**UI Components**:

```typescript
interface PromptBuilder {
  // Content targeting
  audiencePersona: string; // "New car salespeople", "Experienced mechanics", "Healthcare administrators"
  learningObjective: string; // "Product knowledge mastery", "Troubleshooting skills", "Compliance training"
  contentStyle: "conversational" | "formal" | "gamified" | "scenario_based";

  // Bloom's taxonomy targeting
  bloomsLevels: BloomLevel[];

  // Node type selection (optional)
  includedNodeTypes?: NodeType[];
  excludedNodeTypes?: NodeType[];

  // Scenario preferences
  complexityLevel: number; // 1-10 slider (1 = simple linear, 10 = complex branching)

  // Output preferences
  includeVariables: boolean; // start simple
  includeMediaPlaceholders: boolean;
  includeXAPI: boolean;
}
```

#### **2.2 Prompt Preview & Validation**

- **Effort**: Medium (validation system)
- **Value**: Medium (quality assurance)

**Features**:

- Real-time prompt preview
- Estimated token count for different LLMs
- Validation warnings for common issues
- Prompt optimization suggestions

#### **2.3 LLM Integration Testing**

- **Effort**: Medium (API integrations)
- **Value**: High (validate approach)

**Test Integrations**:

- OpenAI GPT-4/GPT-3.5
- Anthropic Claude
- Google Gemini
- Local models (Llama, Mistral)

### **Phase 3: Advanced Features (4-5 weeks)**

**Goal**: Enhanced prompt generation and validation

#### **3.1 Multi-Modal Content Support**

- **Effort**: Large (complex prompt engineering)
- **Value**: Very High (rich content generation)

**Features**:

- Image description integration for hotspot nodes
- Video content guidance for scenario nodes
- Audio content specifications for memory games
- Media placeholder generation with detailed descriptions

#### **3.2 Validation & Quality Assurance**

- **Effort**: Medium (validation system)
- **Value**: High (output quality)

**Components**:

```typescript
interface GeneratedContentValidator {
  validateJSON(content: string): ValidationResult;
  checkNodeConsistency(scenario: NLJScenario): ConsistencyReport;
  validateBloomsProgression(scenario: NLJScenario): BloomsReport;
  suggestImprovements(scenario: NLJScenario): Suggestion[];
}
```

#### **3.3 Prompt Performance Analytics**

- **Effort**: Medium (analytics system)
- **Value**: Medium (continuous improvement)

**Metrics**:

- Success rate by LLM model
- Common generation failures
- Prompt effectiveness scoring
- User satisfaction with generated content

## 🔧 Technical Implementation

### **Prompt Structure**

```markdown
# NLJ Scenario Generation Prompt

## Your Task

Generate a valid NLJ JSON scenario based on the provided source material and requirements.

## Domain & Context Instructions

- Infer the subject domain from the audience persona and source material provided
- Match the content complexity to the audience's expertise level
- Use domain-appropriate terminology and examples
- Ensure scenarios are realistic and relevant to the target audience

## NLJ Schema Overview

[Complete schema documentation]

## Available Node Types

### Question Types

- Multiple Choice (UnifiedQuestionNode)
- True/False (TrueFalseNode)
- Short Answer (ShortAnswerNode)
- Fill-in-the-Blank (FillInBlankNode)
- Ordering (OrderingNode)
- Matching (MatchingNode)
- Classification (ClassificationNode)
- Hotspot (HotspotNode)

### Survey Types

- Likert Scale (LikertScaleNode)
- Rating (RatingNode)
- Matrix (MatrixNode)
- Slider (SliderNode)
- Text Area (TextAreaNode)

### Game Types

- Connections (ConnectionsNode)
- Wordle (WordleNode)
- Memory Game (MemoryGameNode)

### Structural Types

- Interstitial Panel (InterstitialPanelNode)
- Choice (ChoiceNode)
- Start/End (StartNode/EndNode)

## Media Placeholder Guidelines

When including media in scenarios:

- Use detailed placeholder descriptions: "Image: Car engine diagram showing alternator location with parts labeled"
- Specify media purpose: "Video: 2-minute demonstration of proper brake pad replacement procedure"
- Include accessibility descriptions: "Audio: Customer service conversation example with background noise"
- Provide context for content creators: "Stock photo suggestion: Professional mechanic using diagnostic equipment"

## Bloom's Taxonomy Guidelines

[Detailed guidance for each level]

## Variable Usage (Keep Simple)

- Use variables for basic scoring: `correctAnswers`, `totalQuestions`
- Simple conditional logic: `if score >= 80% then success path`
- Avoid complex nested conditions in initial versions

## Example Scenarios

[3-4 complete example scenarios with varying complexity]

## Validation Rules

[Critical validation requirements]

## Your Source Material

[User's content goes here]

## Generation Requirements

- Target audience: {audiencePersona}
- Learning objective: {learningObjective}
- Content style: {contentStyle}
- Complexity level: {complexityLevel}/10
- Target Bloom's levels: {bloomsLevels}
- Include media placeholders: {includeMediaPlaceholders}
- Include variables: {includeVariables}

## Output Format

Provide ONLY valid JSON in the following format:
[JSON structure example]
```

### **Prompt Variations**

- **Basic Prompt**: Essential elements only (~2K tokens)
- **Detailed Prompt**: Full documentation (~8K tokens)
- **Specialized Prompts**: Domain-specific variations
- **Advanced Prompt**: Complex scenarios with variables (~12K tokens)

### **Download Integration**

```typescript
// Add to ScenarioLoader component
const generatePrompt = (options: PromptOptions): string => {
  const template = getPromptTemplate(options.complexity);
  return populateTemplate(template, options);
};

const downloadPrompt = (options: PromptOptions): void => {
  const prompt = generatePrompt(options);
  const blob = new Blob([prompt], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nlj-generation-prompt-${Date.now()}.md`;
  a.click();
};
```

## 🎯 User Workflow

### **Content Creator Experience**

1. **Access Journey Explorer**: Open the scenario loader
2. **Configure Prompt**:
   - Define audience persona (e.g., "New automotive technicians")
   - Set learning objective (e.g., "Master brake system diagnostics")
   - Choose content style (conversational, formal, gamified, scenario-based)
   - Adjust complexity slider (1-10 scale)
   - Select Bloom's levels and optional node type preferences
3. **Download Prompt**: Get customized prompt file with all specifications
4. **Prepare Source Material**: Gather training content, manuals, or documentation
5. **Generate Scenario**: Use LLM with prompt + source material combination
6. **Import & Test**: Load generated JSON into Journey Explorer
7. **Iterate**: Refine persona/objective and regenerate as needed

### **Typical Session Flow**

```
Source Material + Customized Prompt → LLM → NLJ JSON → Journey Explorer
      ↓
User provides:           System provides:        LLM generates:
• Training content       • Complete schema       • Valid scenario
• Audience persona       • Node examples         • Proper structure
• Learning objectives    • Bloom's guidance      • Realistic content
• Style preferences      • Media placeholders    • Working links
• Complexity level       • Validation rules      • Domain-appropriate examples
```

## 📊 Success Metrics

### **Phase 1 KPIs**

- **Prompt Download Rate**: Usage of prompt generation feature
- **JSON Validity**: % of LLM-generated content that parses correctly
- **Node Type Coverage**: Variety of node types in generated content
- **User Satisfaction**: Feedback on prompt effectiveness

### **Phase 2 KPIs**

- **Customization Usage**: % of users who modify default prompts
- **Generation Success**: End-to-end success rate (prompt → working scenario)
- **Iteration Rate**: How often users refine and regenerate
- **Content Quality**: Subjective quality of generated scenarios

### **Phase 3 KPIs**

- **Advanced Feature Adoption**: Usage of multi-modal and validation features
- **Content Creator Efficiency**: Time from idea to working scenario
- **LLM Performance**: Success rates across different models
- **Community Sharing**: User-generated prompt variations

## 🔍 Quality Assurance Strategy

### **Prompt Engineering Best Practices**

- **Clear Instructions**: Unambiguous generation requirements
- **Concrete Examples**: Multiple complete scenario examples
- **Validation Emphasis**: Stress importance of valid JSON structure
- **Error Prevention**: Common mistakes and how to avoid them
- **Iterative Refinement**: Continuous improvement based on results

### **Testing Approach**

- **Multi-LLM Validation**: Test prompts across different models
- **Edge Case Handling**: Complex scenarios with branching and variables
- **Domain Specificity**: Validate across different content domains
- **Human Evaluation**: Content quality assessment by experts

## 🚀 Future Enhancements

### **Advanced Features**

- **Prompt Marketplace**: Community-contributed specialized prompts
- **A/B Testing**: Compare prompt variations for effectiveness
- **Auto-Validation**: Immediate feedback on generated content
- **Content Optimization**: Suggestions for improving generated scenarios

### **Integration Opportunities**

- **LMS Integration**: Direct scenario generation within learning platforms
- **Content Management**: Version control and collaboration on prompts
- **Analytics Dashboard**: Deep insights into generation patterns
- **API Access**: Programmatic prompt generation for enterprise users

This approach leverages the power of modern LLMs while maintaining the functional purity of Journey Explorer as a JSON interpreter, creating a clear separation of concerns between content generation and content consumption.
