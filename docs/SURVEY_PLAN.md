# Survey Dashboard Implementation Plan

## 📈 Current Status: Phase 3 Complete ✅

**Phase 1 (Core Survey Infrastructure)** ✅ **COMPLETED** in 3 days:
- ✅ Data model extensions with follow-up capability for all survey question types
- ✅ xAPI statement builders for survey responses, completion, and distribution tracking  
- ✅ UnifiedSurveyQuestionNode pattern with follow-up UI, validation, and semantic theming
- ✅ Refactored **ALL 5 survey question types** to support both survey and training modes

**Phase 2 (Survey Dashboard UI)** ✅ **COMPLETED**:
- ✅ Surveys tab added to sidebar navigation
- ✅ SurveyDashboard page with card layout and Live/Complete/All tabs
- ✅ SurveyDistributionPage with 3-step workflow
- ✅ Public link generation with copy functionality and QR code placeholders
- ✅ **NEW**: Comprehensive SurveyDetailPage with Analytics, Generated Links, and Responses tabs
- ✅ **NEW**: Updated routing architecture to use proper survey detail page
- ✅ **NEW**: Inline email recipient management system with smart parsing and validation
- ✅ **NEW**: Legacy survey node type support (LikertScaleNode, RatingNode, etc.)
- ✅ **NEW**: Enhanced UI layout matching SourceDetailPage patterns

**Phase 3 (Backend API Integration)** ✅ **COMPLETED**:
- ✅ **Survey Analytics API Router**: Complete `/api/surveys/{id}/stats`, `/api/surveys/{id}/links`, `/api/surveys/{id}/responses` endpoints
- ✅ **Ralph LRS Service Extensions**: Survey-specific xAPI statement processing with verb filtering and graceful error handling
- ✅ **Frontend Survey API Client**: Comprehensive TypeScript API client with proper typing and error handling  
- ✅ **SurveyDetailPage Integration**: Connected to real backend APIs replacing all mock data with live integration
- ✅ **SurveyDistributionPage Integration**: Real link generation using surveys API instead of legacy shared-tokens API
- ✅ **QR Code Generation**: Full QR code functionality with modal display, copy functionality, and mobile-optimized design
- ✅ **Graceful Error Handling**: Ralph LRS unavailability handled with fallback empty statistics instead of 500 errors
- ✅ **Production-Ready API**: All endpoints integrated with existing permission system and database infrastructure

**Phase 2 Enhancements Completed:**
- ✅ **InlineEmailManager Component**: No-modal email management with smart text parsing
- ✅ **Bulk Email Processing**: Paste from Excel, contacts, any text source - auto-splits and validates
- ✅ **Real-time Validation**: Visual chips with green/red validation, duplicate detection
- ✅ **Smart Parsing**: Handles "Name <email@domain.com>", comma/semicolon/newline separated lists
- ✅ **Step Navigation**: Requires valid emails before proceeding in distribution workflow
- ✅ **Bug Fixes**: Survey playback working, ShareModal errors resolved, UI consistency improved

## 🎯 Latest Session Accomplishments (August 11, 2025)

**Backend API Integration (Complete System):**
- ✅ **Survey Analytics API Router** (`/backend/app/api/survey_analytics.py`): 
  - Complete survey statistics endpoints with comprehensive error handling
  - Survey link management with SharedToken service integration
  - Survey response processing with follow-up text extraction
  - Placeholder endpoints for future AI-powered insights
- ✅ **Ralph LRS Service Extensions** (`/backend/app/services/ralph_lrs_service.py`):
  - Survey-specific xAPI statement filtering with verb mapping
  - Graceful error handling for Ralph LRS unavailability
  - Comprehensive survey statistics calculation from xAPI data
  - Follow-up response extraction from xAPI statement extensions
- ✅ **Frontend Survey API Client** (`/frontend/client/surveys.ts`):
  - Complete TypeScript API client with proper interfaces
  - Error handling and response transformation
  - Integration with existing authentication and API infrastructure
- ✅ **SurveyDetailPage Integration**: Connected all tabs to real backend APIs
- ✅ **SurveyDistributionPage Integration**: Real link generation using surveys API
- ✅ **QR Code Generation**: Full implementation using existing sharing patterns

**Production-Ready Features:**
- ✅ **Error Resilience**: System gracefully handles Ralph LRS being unavailable (shows empty stats instead of crashing)
- ✅ **Real-Time Data**: Survey detail page now shows live data from database and xAPI statements
- ✅ **Link Management**: Complete survey link lifecycle (create, view, analytics, revoke)
- ✅ **Mobile QR Codes**: Professional QR code modal with copy functionality and mobile-optimized design
- ✅ **Database Integration**: All survey operations properly integrated with existing PostgreSQL schema

## 🚀 Next Steps (Priority Order)

### 1. Ralph LRS Configuration (High Priority) ⚠️
**Configure Ralph LRS credentials for production analytics**

**Current Issue**: Ralph LRS returning 403 errors due to missing credentials file
**Files to Update:**
- Production deployment configuration for Ralph LRS credentials
- Environment variables for `RALPH_LRS_USERNAME` and `RALPH_LRS_SECRET`
- Docker/deployment configuration to mount Ralph LRS credentials file

### 2. Flow Editor Survey Support (High Priority) ⚠️  
**Enable proper survey creation and editing**

**Critical Issue**: Users currently can't create surveys properly because Flow Editor doesn't support follow-up configuration.

**Files to Update:**
- `frontend/flow-editor/nodes/editors/LikertScaleNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/RatingNodeEditor.tsx` 
- `frontend/flow-editor/nodes/editors/MatrixNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/SliderNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/TextAreaNodeEditor.tsx`

**Tasks:**
- Add follow-up configuration UI to each survey question editor
- Add survey-specific templates to CreateActivityModal
- Ensure proper node type compatibility (legacy vs new formats)

### 3. Email Distribution Service (Medium Priority)
**Implement actual email sending for survey invitations**
- **Email Service Integration**: Connect to SendGrid/SES for sending survey invitations
- **Email Templates**: Professional survey invitation email templates
- **Reminder System**: Automated reminder emails for non-respondents
- **Email Analytics**: Track email opens, clicks, and survey completions

### 4. Advanced Analytics Features (Medium Priority)  
**Enhance survey analytics with AI-powered insights**
- **AI Insights**: Implement placeholder AI endpoints with actual LLM integration
- **Sentiment Analysis**: Process follow-up text responses for sentiment analysis
- **Response Trends**: Advanced charting and trend analysis
- **Export Features**: PDF reports and CSV data export

## Overview

This plan outlines the step-by-step implementation of a comprehensive survey dashboard system within the existing NLJ Viewer platform, leveraging our event-driven architecture (Kafka + xAPI + Elasticsearch) and existing UI patterns.

## Target Features (Based on Figma Designs)

### Core Survey Management
- **Survey Dashboard**: Card-based view with Live/Complete/All tabs
- **Survey Distribution**: Multi-step modal workflow (Email/SMS/Link/Upload)
- **Survey Analytics**: Individual survey results with detailed insights
- **Response Management**: Real-time response tracking and analysis

### Enhanced Survey Capabilities
- **Follow-up Verbatim Responses**: Add optional text follow-up to any survey question
- **Anonymous Response Collection**: Via existing public sharing infrastructure
- **Real-time Analytics**: Live response tracking and milestone notifications
- **Cross-Survey Analysis**: Comparative analytics across multiple surveys

## Architecture Decision

**✅ Leverage Existing Infrastructure**
- Store survey responses as xAPI events in Ralph LRS
- Use Kafka event bus for real-time processing
- Extend existing analytics dashboard for survey-specific metrics
- Reuse Material-UI components and established patterns
- Optional aggregated models only if real-time queries become slow

## Implementation Phases

### Phase 1: Core Survey Infrastructure ✅ COMPLETED (3 days)

#### 1.1 Data Model Extensions ✅ COMPLETED
**Files Modified:**
- `frontend/types/nlj.ts` - Added SurveyFollowUpConfig interface
- Extended all survey node types (LikertScaleNode, RatingNode, MatrixNode, SliderNode, TextAreaNode) with `followUp?: SurveyFollowUpConfig`
- Extended NodeResponse interface with `followUpResponse?: string`

```typescript
// ✅ IMPLEMENTED: Survey follow-up configuration
interface SurveyFollowUpConfig {
  enabled: boolean;
  prompt?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

// ✅ All survey node types now support follow-up
interface LikertScaleNode extends BaseNode {
  // ... existing properties
  followUp?: SurveyFollowUpConfig;
}
// Similarly for RatingNode, MatrixNode, SliderNode, TextAreaNode
```

#### 1.2 xAPI Event Generation ✅ COMPLETED
**Files Modified:**
- `frontend/xapi/builder.ts` - Added survey-specific statement builders
- `frontend/xapi/index.ts` - Added exports for new survey builders

**✅ IMPLEMENTED Events:**
```typescript
// Individual question response with follow-up
buildSurveyResponseStatement(params: {
  actor: XAPIActor;
  surveyId: string;
  questionId: string;
  questionText: string;
  questionType: string;
  response: any;
  followUpResponse?: string;
})

// Survey completion tracking
buildSurveyCompletionStatement(params: {
  actor: XAPIActor;
  surveyId: string;
  surveyTitle: string;
  totalQuestions: number;
  completedQuestions: number;
})

// Survey distribution tracking
buildSurveyDistributionStatement(params: {
  actor: XAPIActor;
  surveyId: string;
  surveyTitle: string;
  distributionMethod: string;
  recipientCount: number;
})
```

#### 1.3 Question Component Enhancement ✅ COMPLETED
**Files Created/Modified:**
- `frontend/player/UnifiedSurveyQuestionNode.tsx` - New unified wrapper component with follow-up UI, validation, and xAPI integration
- `frontend/player/LikertScaleNode.tsx` - Refactored to use UnifiedSurveyQuestionNode pattern with semantic theming
- `frontend/player/RatingNode.tsx` - Refactored to use UnifiedSurveyQuestionNode pattern with semantic theming
- `frontend/player/MatrixNode.tsx` - Refactored to use UnifiedSurveyQuestionNode pattern with semantic theming and responsive design
- `frontend/player/SliderNode.tsx` - Refactored to use UnifiedSurveyQuestionNode pattern with semantic theming and complete slider styling
- `frontend/player/TextAreaNode.tsx` - Refactored to use UnifiedSurveyQuestionNode pattern with semantic theming and validation

**✅ IMPLEMENTED Pattern:**
```typescript
// UnifiedSurveyQuestionNode wraps survey questions with follow-up capability
export const UnifiedSurveyQuestionNode: React.FC<Props> = ({
  question,
  children, // The actual question UI (LikertScale, Rating, etc.)
  onAnswer,
  response,
  hasResponse
}) => {
  // Handles follow-up UI rendering, validation, xAPI statement creation
  // Centralizes survey response logic across all question types
};

// Question components now detect survey vs training mode:
const LikertScaleNode = ({ question, onAnswer }) => {
  const isSurveyQuestion = question.followUp !== undefined;
  
  if (isSurveyQuestion) {
    return (
      <UnifiedSurveyQuestionNode question={question} onAnswer={onAnswer} ...>
        {renderLikertScaleQuestion()}
      </UnifiedSurveyQuestionNode>
    );
  }
  
  // Regular training question rendering...
};
```

**✅ KEY FEATURES IMPLEMENTED:**
- Per-question follow-up configuration (not per-activity)
- Follow-up prompt customization with placeholder text
- Required/optional follow-up responses with validation
- Character limits for follow-up responses with live counting
- Semantic theme colors that adapt to all theme modes
- xAPI statement generation with follow-up responses in extensions
- Unified component pattern for consistent behavior across question types

### Phase 2: Survey Dashboard UI (4-5 days)

#### 2.1 Sidebar Navigation Extension (0.5 days)
**File:** `frontend/shared/SidebarNavigation.tsx`
```typescript
// Add "Surveys" tab after Activities
{
  label: "Surveys",
  path: "/app/surveys", 
  icon: <PollIcon />,
  roles: [UserRole.CREATOR, UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN]
}
```

#### 2.2 Survey Dashboard Page (2 days)
**File:** `frontend/pages/SurveyDashboard.tsx`

**Features:**
- Card-based survey layout (reuse `ContentDashboard` patterns)
- Live/Complete/All tabs with survey-specific filtering
- Survey metrics: Questions, Responses, Response Rate
- "New Survey" button → Activity creation modal with survey template
- "Send Survey" and "View Results" actions per survey card

```typescript
const SurveyDashboard = () => {
  const [activeTab, setActiveTab] = useState('live');
  const [surveys, setSurveys] = useState([]);

  // Fetch surveys with specific filtering
  const fetchSurveys = async (status: 'live' | 'complete' | 'all') => {
    const response = await apiClient.get('/api/content', {
      params: {
        content_type: 'survey',
        state: status === 'live' ? 'published' : undefined,
        // Add completion status filtering based on analytics
      }
    });
    setSurveys(response.data.items);
  };

  return (
    <Box>
      <PageHeader 
        title="Surveys"
        action={
          <Button startIcon={<AddIcon />} variant="contained">
            New Survey
          </Button>
        }
      />
      
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
        <Tab label="Live" value="live" />
        <Tab label="Complete" value="complete" />
        <Tab label="All" value="all" />
      </Tabs>

      <Grid container spacing={3}>
        {surveys.map(survey => (
          <Grid xs={12} md={6} lg={4} key={survey.id}>
            <SurveyCard survey={survey} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
```

#### 2.3 Survey Distribution System ✅ **COMPLETED**
**Files:** 
- `frontend/pages/SurveyDistributionPage.tsx` ✅ **COMPLETED**
- `frontend/components/surveys/InlineEmailManager.tsx` ✅ **COMPLETED**

**✅ COMPLETED Multi-step workflow (3 steps):**
1. **Distribution Method & Recipients** - Choose method and manage recipients in one step
2. **Schedule & Settings** - Configure timing, reminders, and survey settings
3. **Review & Send** - Review configuration and generate public links

**✅ COMPLETED: Inline Email Management Features:**
- **InlineEmailManager Component**: Smart email parsing and validation without modals
- **Bulk Email Processing**: Paste from Excel, contacts, any text - auto-splits and validates
- **Real-time Validation**: Visual chips with green/red validation, duplicate detection
- **Smart Parsing**: Handles "Name <email@domain.com>", comma/semicolon/newline separated
- **Step Integration**: Email validation integrated into distribution workflow

```typescript
const SurveyDistributionModal = ({ surveyId, open, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [distributionConfig, setDistributionConfig] = useState({
    recipients: [],
    method: 'email',
    schedule: { startDate: null, endDate: null },
    enableReminders: true
  });

  const handleDistribute = async () => {
    // Generate public share token for anonymous access
    const shareResponse = await apiClient.post('/api/shared-tokens', {
      content_id: surveyId,
      expires_at: distributionConfig.schedule.endDate
    });

    // Send distribution via configured method
    if (distributionConfig.method === 'email') {
      await sendSurveyEmails(shareResponse.data.token, distributionConfig.recipients);
    }
    
    // Generate xAPI distribution event
    generateSurveyDistributionEvent(surveyId, distributionConfig);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>Send Survey</DialogTitle>
      <DialogContent>
        <Stepper activeStep={currentStep}>
          <Step><StepLabel>Select Recipients</StepLabel></Step>
          <Step><StepLabel>Distribution Method</StepLabel></Step>
          <Step><StepLabel>Schedule</StepLabel></Step>
          <Step><StepLabel>Review</StepLabel></Step>
        </Stepper>
        
        {/* Step content based on currentStep */}
        <StepContent step={currentStep} config={distributionConfig} onChange={setDistributionConfig} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>Back</Button>
        <Button onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}>Next</Button>
        {currentStep === 3 && <Button onClick={handleDistribute}>Send Survey</Button>}
      </DialogActions>
    </Dialog>
  );
};
```

#### 2.4 Survey Analytics Page (1 day)
**File:** `frontend/pages/SurveyAnalyticsPage.tsx`

**Reuse existing analytics infrastructure:**
- Overview metrics (responses, completion rate, average scores)
- Performance charts (response timeline, completion funnel)
- Question-by-question breakdown with verbatim responses
- Promoter/Detractor analysis for rating questions
- **Generated Link Management**: Display all public share links for the survey with:
  - Link URLs with copy functionality
  - Creation dates and expiration status
  - QR code generation for mobile sharing
  - Link usage analytics (views, completions)
  - Ability to revoke or regenerate links

### Phase 3: Analytics Integration (3-4 days)

#### 3.1 Survey-Specific Analytics Endpoints (2 days)
**File:** `backend/app/api/survey_analytics.py`

```python
@router.get("/survey/{survey_id}/overview")
async def get_survey_overview(survey_id: str):
    """Get survey overview metrics"""
    # Query xAPI statements for survey responses
    statements = await ralph_service.get_activity_statements(
        activity_id=survey_id,
        verb_filter="responded,completed"
    )
    
    return {
        "total_questions": count_survey_questions(survey_id),
        "total_responses": len([s for s in statements if s.verb == "responded"]),
        "unique_respondents": len(set([s.actor.email for s in statements])),
        "completion_rate": calculate_completion_rate(statements),
        "response_timeline": aggregate_daily_responses(statements)
    }

@router.get("/survey/{survey_id}/responses")
async def get_survey_responses(survey_id: str):
    """Get detailed survey responses with follow-up text"""
    statements = await ralph_service.get_activity_statements(
        activity_id=survey_id,
        verb_filter="responded"
    )
    
    responses = []
    for statement in statements:
        response_data = {
            "respondent": statement.actor.email,
            "question_id": extract_question_id(statement.object.id),
            "response_value": statement.result.response,
            "timestamp": statement.timestamp
        }
        
        # Include follow-up verbatim if present
        if follow_up := statement.result.extensions.get("follow_up_response"):
            response_data["follow_up_text"] = follow_up
            
        responses.append(response_data)
    
    return {"responses": responses}

@router.get("/survey/{survey_id}/insights")
async def get_survey_insights(survey_id: str):
    """Generate AI-powered survey insights"""
    responses = await get_survey_responses(survey_id)
    
    # Analyze verbatim responses with sentiment analysis
    verbatim_responses = [r["follow_up_text"] for r in responses if "follow_up_text" in r]
    sentiment_analysis = await analyze_response_sentiment(verbatim_responses)
    
    # Category analysis for rating questions
    rating_responses = [r for r in responses if is_rating_question(r["question_id"])]
    nps_analysis = calculate_nps_scores(rating_responses)
    
    return {
        "sentiment_analysis": sentiment_analysis,
        "nps_analysis": nps_analysis,
        "key_themes": extract_response_themes(verbatim_responses),
        "completion_insights": analyze_completion_patterns(responses)
    }
```

#### 3.2 Real-Time Survey Processing (1 day)
**File:** `backend/app/services/survey_event_consumer.py`

```python
@event_consumer("survey_responses")
async def process_survey_response(event: XAPIEvent):
    """Process survey responses in real-time"""
    if event.verb != "responded" or "survey" not in event.object.id:
        return
    
    survey_id = extract_survey_id(event.object.id)
    
    # Update real-time metrics
    await update_survey_metrics_cache(survey_id)
    
    # Check for response milestones
    total_responses = await get_survey_response_count(survey_id)
    if total_responses % 25 == 0:  # Every 25 responses
        await send_milestone_notification(survey_id, total_responses)
    
    # Process follow-up responses for sentiment analysis
    if follow_up := event.result.extensions.get("follow_up_response"):
        await queue_sentiment_analysis(survey_id, follow_up)
```

#### 3.3 Dashboard Analytics Integration (1 day)
**Extend existing analytics dashboard with survey-specific tabs:**

```typescript
// Add to AnalyticsDashboard.tsx
const SurveyAnalyticsTab = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📊 Survey Response Analytics
      </Typography>
      
      {/* Response Rate Trends */}
      <Card>
        <CardContent>
          <Typography variant="h6">Response Rate Trends</Typography>
          <LineChart data={surveyResponseTrends} />
        </CardContent>
      </Card>
      
      {/* Top Performing Surveys */}
      <Card>
        <CardContent>
          <Typography variant="h6">Top Performing Surveys</Typography>
          <SurveyPerformanceTable />
        </CardContent>
      </Card>
      
      {/* Verbatim Response Analysis */}
      <Card>
        <CardContent>
          <Typography variant="h6">Verbatim Response Insights</Typography>
          <SentimentAnalysisChart />
          <KeyThemesWordCloud />
        </CardContent>
      </Card>
    </Box>
  );
};
```

### Phase 4: Flow Editor Integration (2-3 days) ⚠️ **REQUIRED FOR SURVEY CREATION**

**⚠️ CRITICAL:** Flow Editor enhancements are **REQUIRED** to enable survey creation workflows. Without these updates, users cannot configure follow-up responses in the survey authoring interface.

#### 4.1 Survey Question Node Editors (2 days)
**Enhance existing question node editors with follow-up capability:**

**Files to Update:**
- `frontend/flow-editor/nodes/editors/LikertScaleNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/RatingNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/MatrixNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/SliderNodeEditor.tsx`
- `frontend/flow-editor/nodes/editors/TextAreaNodeEditor.tsx`

```typescript
// Extend LikertScaleNodeEditor, RatingNodeEditor, etc.
const EnhancedQuestionEditor = ({ nodeData, onChange }) => {
  const [enableFollowUp, setEnableFollowUp] = useState(nodeData.enableFollowUp || false);
  const [followUpPrompt, setFollowUpPrompt] = useState(nodeData.followUpPrompt || '');
  const [followUpRequired, setFollowUpRequired] = useState(nodeData.followUpRequired || false);

  return (
    <Box>
      {/* Existing question editor UI */}
      <ExistingQuestionEditor />
      
      {/* Follow-up configuration */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" gutterBottom>Follow-up Response</Typography>
      
      <FormControlLabel
        control={
          <Switch
            checked={enableFollowUp}
            onChange={(e) => {
              setEnableFollowUp(e.target.checked);
              onChange({ ...nodeData, enableFollowUp: e.target.checked });
            }}
          />
        }
        label="Enable follow-up verbatim response"
      />
      
      {enableFollowUp && (
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Follow-up Prompt"
            placeholder="Please explain your answer..."
            value={followUpPrompt}
            onChange={(e) => {
              setFollowUpPrompt(e.target.value);
              onChange({ ...nodeData, followUpPrompt: e.target.value });
            }}
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={followUpRequired}
                onChange={(e) => {
                  setFollowUpRequired(e.target.checked);
                  onChange({ ...nodeData, followUpRequired: e.target.checked });
                }}
              />
            }
            label="Follow-up response required"
          />
        </Box>
      )}
    </Box>
  );
};
```

#### 4.2 Survey Templates (1 day)
**Add survey-specific templates to CreateActivityModal:**

```typescript
const SURVEY_TEMPLATES = [
  {
    id: 'employee_satisfaction',
    name: 'Employee Satisfaction Survey',
    description: 'Comprehensive employee satisfaction and engagement survey',
    nodes: [
      // Pre-built survey flow with Likert scales, ratings, and follow-up questions
      {
        type: 'likert',
        questionText: 'How satisfied are you with your current role?',
        scale: '1-5',
        enableFollowUp: true,
        followUpPrompt: 'What specific aspects contribute most to your satisfaction level?'
      },
      // More nodes...
    ]
  },
  {
    id: 'nps_survey',
    name: 'Net Promoter Score Survey',
    description: 'Standard NPS survey with follow-up questions',
    nodes: [
      {
        type: 'rating',
        questionText: 'How likely are you to recommend our company to a friend?',
        scale: '0-10',
        enableFollowUp: true,
        followUpPrompt: 'What is the primary reason for your score?',
        followUpRequired: true
      }
    ]
  }
];
```

### Phase 5: Testing & Polish (2-3 days)

#### 5.1 xAPI Event Validation (1 day)
- Test survey response events are properly generated
- Verify follow-up responses appear in xAPI statements
- Validate event structure matches Learning Record Store requirements

#### 5.2 End-to-End Survey Workflow (1 day)  
- Survey creation → distribution → response collection → analytics
- Test anonymous response collection via public sharing
- Verify real-time analytics updates

#### 5.3 UI/UX Polish (1 day)
- Responsive design across devices
- Loading states and error handling
- Accessibility compliance
- Performance optimization

## Success Metrics

### Technical Metrics
- [ ] Survey responses stored as xAPI events in Ralph LRS
- [ ] Real-time analytics update within 30 seconds of response
- [ ] Follow-up verbatim responses captured in 100% of enabled questions
- [ ] Survey distribution via existing sharing infrastructure
- [ ] Zero new database tables (leverage existing xAPI storage)

### User Experience Metrics  
- [ ] Survey creation time < 10 minutes (using templates)
- [ ] Response collection rate > 80% (anonymous access)
- [ ] Analytics dashboard loads < 3 seconds
- [ ] Mobile-responsive survey taking experience
- [ ] Consistent UI patterns with existing platform

## Risk Mitigation

### Performance Concerns
- **Risk**: Large-scale survey responses may slow xAPI queries
- **Mitigation**: Add optional aggregated summary tables if needed, but start with pure xAPI approach

### Data Privacy
- **Risk**: Anonymous survey responses may need special handling
- **Mitigation**: Leverage existing public sharing infrastructure which already handles anonymous access

### Integration Complexity
- **Risk**: Survey-specific features may not integrate well with existing workflows
- **Mitigation**: Extend existing patterns rather than creating parallel systems

## Future Enhancements (Post-MVP)

### Advanced Analytics
- **Predictive Response Analysis**: ML models to predict survey completion likelihood
- **Cross-Survey Correlation**: Analyze response patterns across multiple surveys
- **Automated Insights**: AI-generated survey insights and recommendations

### Distribution Features
- **Reminder Automation**: Kafka-based automated reminder system
- **Response Rate Optimization**: A/B testing for survey distribution methods
- **Integration APIs**: Webhook integrations for external systems

### Advanced Question Types
- **Conditional Logic**: Show/hide questions based on previous responses  
- **Question Randomization**: Randomize question order to reduce bias
- **Media Integration**: Image/video questions using existing media infrastructure

## Conclusion

This implementation plan leverages the NLJ Viewer platform's existing strengths:
- Event-driven architecture (Kafka + xAPI) handles survey responses naturally
- Existing analytics infrastructure provides immediate survey insights
- Established UI patterns ensure consistent user experience
- Public sharing system enables anonymous survey distribution

The addition of follow-up verbatim responses enhances survey depth while maintaining architectural simplicity. By storing everything as xAPI events, we maintain data consistency and enable powerful cross-system analytics without introducing architectural complexity.

**Total Estimated Timeline: 16-22 days** for a production-ready survey dashboard matching the Figma designs.