# Post-Activity Experience Documentation

## Overview

This document outlines the post-activity experience system for the unified Activity Viewer, including xAPI event tracking, results presentation, and data export capabilities. The system provides comprehensive feedback and analytics for training scenarios, surveys, and assessments.

## xAPI Integration

### xAPI Statement Structure

All user interactions generate xAPI statements following the standard format:
```json
{
  "actor": {
    "name": "John Doe",
    "mbox": "mailto:john.doe@example.com",
    "objectType": "Agent"
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/experienced",
    "display": {
      "en-US": "experienced"
    }
  },
  "object": {
    "id": "http://example.com/activities/nlj-scenario-123",
    "definition": {
      "name": {
        "en-US": "Customer Service Training"
      },
      "type": "http://adlnet.gov/expapi/activities/course"
    }
  },
  "result": {
    "completion": true,
    "success": true,
    "score": {
      "scaled": 0.85,
      "raw": 17,
      "min": 0,
      "max": 20
    },
    "duration": "PT5M30S"
  },
  "context": {
    "platform": "NLJ Activity Viewer",
    "language": "en-US",
    "extensions": {
      "http://example.com/extensions/activity-type": "training",
      "http://example.com/extensions/theme": "hyundai"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common xAPI Verbs

#### Training Activities
- `experienced` - User experienced the training content
- `completed` - User completed the training scenario
- `passed` - User successfully passed the training
- `failed` - User failed the training requirements
- `suspended` - User suspended the training session
- `resumed` - User resumed a suspended training session
- `answered` - User answered a question
- `skipped` - User skipped a question

#### Survey Activities  
- `responded` - User responded to a survey question
- `completed` - User completed the survey
- `abandoned` - User abandoned the survey
- `reviewed` - User reviewed their responses
- `submitted` - User submitted survey responses

#### Assessment Activities
- `attempted` - User attempted an assessment
- `passed` - User passed the assessment
- `failed` - User failed the assessment
- `scored` - User received a score

### Activity Types and Objects

#### Training Scenarios
```json
{
  "object": {
    "id": "http://example.com/activities/nlj-training-customer-service",
    "definition": {
      "name": {
        "en-US": "Customer Service Training Scenario"
      },
      "type": "http://adlnet.gov/expapi/activities/simulation",
      "extensions": {
        "http://example.com/extensions/activity-type": "training",
        "http://example.com/extensions/scenario-id": "customer-service-v1",
        "http://example.com/extensions/version": "1.0"
      }
    }
  }
}
```

#### Survey Activities
```json
{
  "object": {
    "id": "http://example.com/activities/survey-employee-engagement",
    "definition": {
      "name": {
        "en-US": "Employee Engagement Survey"
      },
      "type": "http://id.tincanapi.com/activitytype/survey",
      "extensions": {
        "http://example.com/extensions/activity-type": "survey",
        "http://example.com/extensions/survey-category": "employee-engagement",
        "http://example.com/extensions/anonymous": true
      }
    }
  }
}
```

#### Individual Questions
```json
{
  "object": {
    "id": "http://example.com/activities/question-q1080",
    "definition": {
      "name": {
        "en-US": "Manager Focus Assessment"
      },
      "type": "http://adlnet.gov/expapi/activities/cmi.interaction",
      "interactionType": "likert",
      "extensions": {
        "http://example.com/extensions/question-id": "Q1080",
        "http://example.com/extensions/question-category": "manager-effectiveness"
      }
    }
  }
}
```

### Event Tracking Implementation

#### Activity Launch
```typescript
const activityLaunchedStatement = {
  actor: getCurrentActor(),
  verb: {
    id: "http://adlnet.gov/expapi/verbs/launched",
    display: { "en-US": "launched" }
  },
  object: getActivityObject(),
  context: {
    platform: "NLJ Activity Viewer",
    language: "en-US",
    extensions: {
      "http://example.com/extensions/session-id": sessionId,
      "http://example.com/extensions/user-agent": navigator.userAgent
    }
  },
  timestamp: new Date().toISOString()
};
```

#### Question Answered
```typescript
const questionAnsweredStatement = {
  actor: getCurrentActor(),
  verb: {
    id: "http://adlnet.gov/expapi/verbs/answered",
    display: { "en-US": "answered" }
  },
  object: getQuestionObject(questionId),
  result: {
    response: userResponse,
    success: isCorrect,
    duration: getResponseTime(),
    extensions: {
      "http://example.com/extensions/attempts": attemptCount,
      "http://example.com/extensions/question-type": questionType
    }
  },
  context: {
    parent: getActivityObject(),
    extensions: {
      "http://example.com/extensions/session-id": sessionId
    }
  },
  timestamp: new Date().toISOString()
};
```

#### Activity Completed
```typescript
const activityCompletedStatement = {
  actor: getCurrentActor(),
  verb: {
    id: "http://adlnet.gov/expapi/verbs/completed",
    display: { "en-US": "completed" }
  },
  object: getActivityObject(),
  result: {
    completion: true,
    success: overallSuccess,
    score: {
      scaled: scaledScore,
      raw: rawScore,
      min: minPossibleScore,
      max: maxPossibleScore
    },
    duration: getTotalDuration()
  },
  context: {
    extensions: {
      "http://example.com/extensions/session-id": sessionId,
      "http://example.com/extensions/completion-time": completionTime
    }
  },
  timestamp: new Date().toISOString()
};
```

## Post-Activity Results Dashboard

### Training Results
```typescript
interface TrainingResults {
  activityId: string;
  activityName: string;
  completionStatus: 'completed' | 'incomplete' | 'failed';
  score: {
    raw: number;
    scaled: number;
    percentage: number;
    min: number;
    max: number;
  };
  duration: string; // ISO 8601 format
  questionsAnswered: number;
  questionsTotal: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  attempts: number;
  completionTime: Date;
  questionBreakdown: Array<{
    questionId: string;
    questionText: string;
    questionType: string;
    userAnswer: any;
    correctAnswer: any;
    isCorrect: boolean;
    timeSpent: number;
    attempts: number;
  }>;
}
```

### Survey Results
```typescript
interface SurveyResults {
  activityId: string;
  activityName: string;
  completionStatus: 'completed' | 'partial' | 'abandoned';
  responseCount: number;
  totalQuestions: number;
  completionRate: number;
  duration: string;
  completionTime: Date;
  responses: Array<{
    questionId: string;
    questionText: string;
    questionType: string;
    response: any;
    skipped: boolean;
    timeSpent: number;
  }>;
  metadata: {
    sessionId: string;
    anonymous: boolean;
    userId?: string;
    demographics?: Record<string, any>;
  };
}
```

### Assessment Results
```typescript
interface AssessmentResults {
  activityId: string;
  activityName: string;
  completionStatus: 'passed' | 'failed' | 'incomplete';
  score: {
    raw: number;
    scaled: number;
    percentage: number;
    passingScore: number;
    min: number;
    max: number;
  };
  duration: string;
  questionsCorrect: number;
  questionsIncorrect: number;
  questionsSkipped: number;
  totalQuestions: number;
  attempts: number;
  completionTime: Date;
  certification?: {
    eligible: boolean;
    certificateId?: string;
    expirationDate?: Date;
  };
}
```

## Results Display Components

### Training Results Display
- **Score Card**: Large, prominent display of final score with pass/fail indicator
- **Performance Summary**: Breakdown of correct/incorrect answers with visual indicators
- **Question Review**: Detailed review of each question with user's answer vs correct answer
- **Time Analytics**: Total time spent, average time per question
- **Retry Options**: Ability to retry failed scenarios
- **Certificate Generation**: For passed training scenarios

### Survey Results Display
- **Completion Confirmation**: Thank you message with completion confirmation
- **Response Summary**: High-level summary of responses (if not anonymous)
- **Participation Stats**: Response rate, completion time
- **Next Steps**: Information about how responses will be used
- **Contact Information**: For follow-up questions or concerns

### Assessment Results Display
- **Pass/Fail Status**: Clear indication of assessment outcome
- **Score Details**: Comprehensive scoring breakdown
- **Competency Analysis**: Performance by skill area or topic
- **Remediation Recommendations**: Suggested follow-up training for failed areas
- **Certification Status**: Certificate eligibility and generation

## Data Export Capabilities

### JSON Export
Complete activity data including all xAPI statements:
```json
{
  "activitySession": {
    "sessionId": "session-123",
    "activityId": "customer-service-training",
    "activityType": "training",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T10:35:30.000Z",
    "completed": true,
    "results": {
      "score": 85,
      "passed": true,
      "duration": "PT35M30S"
    }
  },
  "xapiStatements": [
    {
      "actor": {...},
      "verb": {...},
      "object": {...},
      "result": {...},
      "context": {...},
      "timestamp": "2024-01-15T10:00:00.000Z"
    }
  ],
  "responseData": {
    "questions": [...],
    "responses": [...],
    "interactions": [...]
  }
}
```

### CSV Export
Structured data for analysis:
```csv
SessionId,ActivityId,ActivityType,QuestionId,QuestionType,UserResponse,CorrectAnswer,IsCorrect,TimeSpent,Timestamp
session-123,customer-service,training,Q1,multiple_choice,B,B,true,45,2024-01-15T10:05:00.000Z
session-123,customer-service,training,Q2,true_false,true,false,false,30,2024-01-15T10:06:00.000Z
```

### PDF Reports
- Executive summary for management
- Individual performance reports
- Certification documents
- Detailed analytics reports

## Integration with Learning Management Systems

### SCORM Integration
- Package activities as SCORM content
- Support for SCORM 1.2 and 2004 standards
- Grade passback to LMS

### xAPI/Tin Can Integration
- Configurable LRS endpoints
- Statement batching and retry logic
- Offline statement storage

### Custom API Integration
- RESTful API for external systems
- Webhook support for real-time updates
- Custom authentication mechanisms

## Privacy and Security

### Data Handling
- Secure storage of xAPI statements
- Encryption of sensitive data
- GDPR compliance for EU users
- Data retention policies

### Anonymous vs. Authenticated
- Anonymous mode: No personal identification
- Authenticated mode: User tracking with consent
- Configurable privacy levels

### Data Export Security
- Role-based access to export functions
- Audit logging for data access
- Secure file transfer protocols

## Implementation Timeline

### Phase 1: Basic Results Display
- Create results dashboard components
- Implement basic xAPI statement generation
- Add JSON export functionality

### Phase 2: Advanced Analytics
- Detailed performance analytics
- CSV export capabilities
- PDF report generation

### Phase 3: External Integration
- LRS integration
- SCORM packaging
- Custom API endpoints

### Phase 4: Enterprise Features
- Advanced security features
- Multi-tenant support
- Compliance reporting

This post-activity experience system provides comprehensive feedback and analytics while maintaining user privacy and supporting various integration scenarios.