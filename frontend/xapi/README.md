# Standalone xAPI Module

A complete, reusable xAPI (Experience API) implementation for tracking learning experiences. This module is designed to be standalone and can be easily extracted and used in other projects.

## Features

- ✅ **Full xAPI 1.0.3 compliance** - Complete implementation of the xAPI specification
- ✅ **TypeScript support** - Fully typed interfaces and strong type safety
- ✅ **Fluent Builder API** - Intuitive statement creation with method chaining
- ✅ **LRS Client** - HTTP client for sending statements to Learning Record Store
- ✅ **Offline Support** - Queue statements when offline and sync when online
- ✅ **Validation** - Built-in validation with detailed error reporting
- ✅ **Event-driven** - Convert high-level events to xAPI statements
- ✅ **Zero dependencies** - No external dependencies for core functionality
- ✅ **Reusable** - Can be extracted and used in other projects

## Quick Start

```typescript
import { createStatement, createActor, createActivity, XAPI_VERBS } from './xapi';

// Create a simple learning statement
const statement = createStatement()
  .setActor(createActor({ 
    name: 'John Doe', 
    email: 'john@example.com' 
  }))
  .setVerb(XAPI_VERBS.COMPLETED)
  .setObject(createActivity({ 
    id: 'http://example.com/course/1', 
    name: 'Introduction to xAPI' 
  }))
  .build();

console.log(statement);
```

## Core Components

### Types (`types.ts`)
- Complete xAPI type definitions
- Predefined verbs and activity types
- Event interfaces for learning activities
- Configuration interfaces

### Builder (`builder.ts`)
- Fluent statement builder API
- Factory functions for common objects
- Event to statement converters
- Validation utilities

### Client (`client.ts`)
- HTTP client for LRS communication
- Batch processing and queuing
- Offline support with local storage
- Retry logic and error handling

### Index (`index.ts`)
- Main module exports
- Convenience functions
- Package information

## Usage Examples

### Basic Statement Creation

```typescript
import { createStatement, createActor, createActivity, XAPI_VERBS } from './xapi';

const actor = createActor({
  name: 'Jane Smith',
  email: 'jane@example.com'
});

const activity = createActivity({
  id: 'http://example.com/quiz/1',
  name: 'JavaScript Quiz',
  type: XAPI_ACTIVITY_TYPES.ASSESSMENT
});

const statement = createStatement()
  .setActor(actor)
  .setVerb(XAPI_VERBS.COMPLETED)
  .setObject(activity)
  .setResult({
    success: true,
    completion: true,
    score: { raw: 85, scaled: 0.85, min: 0, max: 100 }
  })
  .build();
```

### Question Interaction

```typescript
import { questionEventToStatement } from './xapi';

const questionEvent = {
  type: 'answered' as const,
  activityId: 'quiz-1',
  activityName: 'JavaScript Quiz',
  activityType: XAPI_ACTIVITY_TYPES.ASSESSMENT,
  questionId: 'question-1',
  questionType: 'multiple-choice',
  actor: createActor({ name: 'Student', email: 'student@example.com' }),
  response: 'A',
  isCorrect: true,
  timeSpent: 30,
  attempts: 1
};

const statement = questionEventToStatement(questionEvent);
```

### LRS Integration

```typescript
import { createXAPIClient } from './xapi';

const client = createXAPIClient({
  endpoint: 'https://lrs.example.com/xapi',
  username: 'your-username',
  password: 'your-password'
});

// Send a single statement
const response = await client.sendStatement(statement);

// Send multiple statements
const responses = await client.sendStatements([statement1, statement2]);

// Test connection
const connectionTest = await client.testConnection();
```

### Offline Support

```typescript
import { createOfflineXAPIClient } from './xapi';

const offlineClient = createOfflineXAPIClient({
  endpoint: 'https://lrs.example.com/xapi',
  username: 'your-username',
  password: 'your-password'
});

// Statements are automatically queued when offline
await offlineClient.sendStatement(statement);

// Sync when back online
await offlineClient.syncOfflineStatements();
```

## Event-Driven Architecture

The module supports converting high-level learning events to xAPI statements:

```typescript
import { eventToStatement, questionEventToStatement, surveyEventToStatement } from './xapi';

// Learning activity event
const activityEvent = {
  type: 'completed',
  activityId: 'course-1',
  activityName: 'Introduction Course',
  activityType: XAPI_ACTIVITY_TYPES.COURSE,
  actor: createActor({ name: 'User', email: 'user@example.com' }),
  result: { completion: true, success: true }
};

const statement = eventToStatement(activityEvent);
```

## Validation

Built-in validation ensures statements meet xAPI requirements:

```typescript
import { validateStatement } from './xapi';

const validation = validateStatement(statement);

if (!validation.valid) {
  console.error('Invalid statement:', validation.errors);
}
```

## Extracting for Reuse

To use this module in another project:

1. **Copy the entire `xapi` folder** to your project
2. **Update imports** to match your project structure
3. **Install TypeScript** if not already present
4. **Add to your build process** as needed

The module is designed to be completely standalone with no external dependencies for core functionality.

## File Structure

```
xapi/
├── types.ts          # Core xAPI types and interfaces
├── builder.ts        # Statement builder and utilities
├── client.ts         # LRS client and offline support
├── index.ts          # Main module exports
├── __tests__/        # Test files
│   └── xapi.test.ts  # Comprehensive tests
└── README.md         # This file
```

## Testing

The module includes comprehensive tests:

```bash
npm test -- xapi
```

## xAPI Compliance

This implementation follows the xAPI 1.0.3 specification:

- ✅ Statement structure and required fields
- ✅ Actor, Verb, Object, Result, Context
- ✅ Activity definitions and interaction types
- ✅ Score validation and scaling
- ✅ Timestamp and duration formats
- ✅ Language maps and extensions
- ✅ Statement references and attachments

## Common Use Cases

### E-Learning Platforms
- Track course completion
- Record quiz attempts and scores
- Monitor learning progress
- Generate learning analytics

### Corporate Training
- Track employee training completion
- Record certification achievements
- Monitor skill development
- Generate compliance reports

### Survey Systems
- Track survey responses
- Record completion rates
- Monitor engagement metrics
- Analyze response patterns

### Assessment Tools
- Track assessment attempts
- Record scores and performance
- Monitor question-level analytics
- Generate detailed reports

## Contributing

When making changes to this module:

1. Ensure TypeScript compliance
2. Update tests for new functionality
3. Maintain backward compatibility
4. Update documentation
5. Consider impact on reusability

## License

This module is part of the NLJ Viewer project and follows the same license terms.