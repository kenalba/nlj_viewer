Cal.com Integration Implementation Plan
AI-Enhanced In-Person Training Registration & Scheduling System
Document Version: 2.0
Date: August 2025
Updated: Event-Driven Architecture with Self-Hosted Cal.com and MVP Kafka Integration
Project: Hyundai/Genesis Learning Management System Enhancement

1. Executive Summary
This document outlines the implementation plan for integrating a self-hosted Cal.com instance into the existing NLJ Learning Platform to provide AI-enhanced in-person training (ILT) registration and scheduling capabilities. The solution uses an event-driven architecture with Kafka message broker to enable real-time, scalable integration while maintaining clean separation of concerns.

1.1 Key Objectives

Automate in-person training registration workflows with event-driven real-time updates
Provide intelligent alternative session suggestions when classes are full
Enable real-time availability tracking and notifications via Kafka event bus
Support multi-platform access (desktop and mobile) with responsive design
Integrate seamlessly with existing FastAPI/React/PostgreSQL architecture
Establish foundation for future Learning Record Store (LRS) integration
Maintain data ownership and security through self-hosted Cal.com deployment

1.2 Scope
This implementation focuses specifically on Requirement #3 from the RFP: "AI-Enhanced In-Person Training Registration & Scheduling" while supporting related requirements for reporting, notifications, and mobile access.

2. Requirements Analysis
2.1 Primary Requirements
GENAI_005: ILT & Training Enhancement

Automated scanning of open ILT classes
Identification of learners who haven't completed required training
Intelligent recommendation of available classes based on learner profiles
Advanced scheduling capabilities with alternative suggestions

GENAI_029: Centralized Training Platform

Support for all training program types:

Onboarding
New hire training
Compliance/certification
Employee development
Customer and partner training



2.2 Supporting Requirements
Requirement IDDescriptionImpact on ImplementationGENAI_067Mobile enrollment supportRequires responsive UI designGENAI_075Real-time instructor dashboardsNeed webhook integration for live updatesGENAI_076Manager notificationsNotification service for enrollment changesGENAI_084No-show reportingAttendance tracking post-sessionGENAI_089Late cancellation reportingCancellation policy enforcementGENAI_105Fully responsive UIMobile-first design approach

3. System Architecture
3.1 High-Level Architecture (Event-Driven with MVP Kafka)
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   NLJ Frontend  │────▶│  NLJ FastAPI    │────▶│  NLJ PostgreSQL │
│   (React App)   │     │  (Business      │     │  (Learning Data)│
└─────────────────┘     │   Logic)        │     └─────────────────┘
         │               └─────────────────┘
         │                       │
         │                       ▼
         │               ┌─────────────────┐
         │               │  Kafka Event    │
         │               │  Bus (MVP)      │
         │               │  - xAPI Events  │
         │               │  - Single Node  │
         │               └─────────────────┘
         │                       │
         │                       ▼
         │               ┌─────────────────┐     ┌─────────────────┐
         └─────────────▶ │  Cal.com        │────▶│ Cal.com         │
                         │  (Self-hosted)  │     │ PostgreSQL      │
                         │  (Docker)       │     │ (Schedule Data) │
                         └─────────────────┘     └─────────────────┘
                                 │
                                 ▼
                         ┌─────────────────┐
                         │ Future: LRS     │
                         │ (Kafka Consumer)│
                         └─────────────────┘
3.2 Integration Points

NLJ Platform ↔ Kafka Event Bus

xAPI event production for training activities
Event consumption for scheduling updates
Learning analytics and progress tracking
Future LRS integration preparation


Kafka ↔ Cal.com Integration

Webhook-to-Kafka bridge for booking events
Event-driven session creation and updates
Real-time availability synchronization
Attendance and completion tracking


NLJ FastAPI ↔ Cal.com API (Direct Integration)

Session creation and management
User synchronization (API-based)
Availability checking and booking
Instructor dashboard data


React Frontend Integration

Embedded Cal.com booking widgets
Custom scheduling UI components
Real-time availability display
Mobile-responsive booking interface




4. Functional Specifications
4.1 User Roles and Permissions
RoleKey CapabilitiesLearnerBrowse sessions, register, view schedule, receive suggestionsInstructorView rosters, mark attendance, receive notificationsManagerTrack team compliance, assign training, view reportsAdminCreate sessions, configure rules, manage system settingsDealer AdminManage dealer-specific users and compliance
4.2 Core Features
4.2.1 Session Management

Create and configure training sessions with:

Multiple locations (training centers)
Capacity limits
Prerequisites
Instructor assignments
Waitlist options



4.2.2 Intelligent Recommendations
When a session is full, the system will suggest alternatives based on:

Proximity: Distance from learner's preferred location
Availability: Soonest available session
Relevance: Similar topics or same certification track

4.2.3 Registration Workflow

Learner browses available sessions
System shows real-time availability
If full, system presents up to 3 alternatives
Learner can register or join waitlist
Automatic confirmation and calendar integration
Reminder notifications (1 week, 1 day before)

4.2.4 Reporting and Analytics

Real-time dashboards for all user roles
No-show tracking and reporting
Compliance status monitoring
Training completion rates
Alternative suggestion effectiveness metrics


5. Technical Implementation Plan
5.1 Phase 1: Foundation & Event Infrastructure (Week 1-2) ✅ COMPLETE

Objectives

Set up self-hosted Cal.com with Docker ✅
Deploy MVP Kafka event bus ✅
Establish event-driven integration patterns ✅
Configure development environment ✅

Deliverables

Cal.com Self-Hosted Deployment ✅

Docker container configuration with separate PostgreSQL ✅
Community Docker setup from calcom/docker repository ✅
Basic Cal.com authentication and configuration ✅
Network isolation and security setup ✅
Prisma database schema migration completed ✅


MVP Kafka Event Bus ✅

Single-node Kafka with KRaft mode (no Zookeeper required) ✅
Basic topic configuration for xAPI events ✅
Development-ready message broker ✅
Foundation for event-driven architecture ✅


NLJ Platform Extensions ✅

Kafka client integration in FastAPI backend ✅
Basic xAPI event producer/consumer setup ✅
Webhook-to-Kafka bridge endpoints ✅
Event schema validation ✅


Database Architecture ✅

Separate PostgreSQL instance for Cal.com scheduling data ✅
NLJ database extensions for event tracking metadata ✅
User preference and location data models ✅
Integration reference tables (Cal.com event IDs) ✅



Technical Considerations

Self-hosted Cal.com configuration and environment variables
MVP Kafka setup with KRaft mode and single replication factor for development
Event schema design following xAPI standards
API-based user synchronization between NLJ and Cal.com systems
Development webhook testing setup (ngrok or local tunneling)

5.2 Phase 2: Core Scheduling & Event Integration (Week 3-4)
Objectives

Implement basic scheduling functionality with event-driven updates
Create Cal.com event types for training sessions
Build registration flow with Kafka event tracking
Establish xAPI event patterns for learning analytics

Deliverables

Cal.com Event Type Configuration

Training session templates with capacity limits
Multi-location support and geospatial data
Instructor assignment and availability rules
Prerequisites integration with NLJ content completion


Event-Driven Registration API

Availability checking via Cal.com API
Booking creation with automatic xAPI event generation
Waitlist management with event notifications
Real-time status updates via Kafka consumers


Basic UI Components with Event Integration

Session browser with real-time availability
Registration form with immediate confirmation
Confirmation screens with calendar integration
Event-driven status updates and notifications



Technical Considerations

Event schema standardization using xAPI vocabulary
Timezone handling for multi-location training sessions  
Concurrency control for booking conflicts and race conditions
Mobile-first responsive design with embedded Cal.com widgets
Error handling and event retry mechanisms for reliability

5.3 Phase 3: AI Enhancement Features (Week 5-6)
Objectives

Implement intelligent alternative suggestions
Add prerequisite checking
Build recommendation engine

Deliverables

Alternative Suggestion Algorithm

Location-based scoring
Availability scoring
Topic relevance scoring
Combined ranking system


Prerequisite Management

Course dependency tracking
Automatic eligibility checking
Clear messaging for ineligible learners


Enhanced UI

Alternative suggestions display
Comparison view for options
One-click alternative registration



Technical Considerations

Optimize database queries for performance
Consider caching strategies for recommendations
Ensure algorithm transparency for users

5.4 Phase 4: Notifications & Reporting (Week 7-8)
Objectives

Implement comprehensive notification system
Build reporting dashboards
Add compliance tracking

Deliverables

Notification System

Email templates
SMS integration (optional)
Configurable reminder schedules
Manager notifications


Reporting Dashboards

Learner dashboard
Instructor roster view
Manager team view
Admin analytics


Compliance Features

Automatic gap identification
Deadline tracking
Escalation workflows



Technical Considerations

Choose appropriate notification service (SendGrid, AWS SES, etc.)
Design for report performance with large datasets
Implement proper data retention policies

5.5 Phase 5: Testing & Deployment (Week 9-10)
Objectives

Comprehensive testing
Performance optimization
Production deployment

Deliverables

Testing Suite

Unit tests for algorithms
Integration tests for Cal.com
End-to-end user flow tests
Load testing for concurrent bookings


Documentation

Admin user guide
API documentation
Deployment procedures
Troubleshooting guide


Deployment

Production environment setup
Data migration plan
Rollback procedures
Monitoring configuration




6. Infrastructure Configuration

6.1 Docker Compose Setup
The implementation uses Docker containers for all services to ensure consistent deployment across development and production environments.

Complete docker-compose.yml Configuration

```yaml
version: '3.8'

services:
  # Existing NLJ Platform services
  nlj-frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - nlj-api

  nlj-api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://nlj_user:nlj_pass@nlj-db:5432/nlj_platform
      - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
    depends_on:
      - nlj-db
      - kafka

  nlj-db:
    image: postgres:15
    environment:
      POSTGRES_DB: nlj_platform
      POSTGRES_USER: nlj_user
      POSTGRES_PASSWORD: nlj_pass
    volumes:
      - nlj_db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Event Infrastructure - Kafka (KRaft Mode)
  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      # KRaft Configuration
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: 'broker,controller'
      KAFKA_CONTROLLER_QUORUM_VOTERS: '1@kafka:9093'
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER'
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT'
      KAFKA_LISTENERS: 'PLAINTEXT://kafka:29092,CONTROLLER://kafka:9093,PLAINTEXT_HOST://0.0.0.0:9092'
      KAFKA_INTER_BROKER_LISTENER_NAME: 'PLAINTEXT'
      KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092'
      
      # Cluster Configuration
      CLUSTER_ID: 'MkU3OEVBNTcwNTJENDM2Qk'
      
      # Replication and ISR Settings (for single node)
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      
      # Log Configuration
      KAFKA_LOG_RETENTION_HOURS: 168
      KAFKA_LOG_SEGMENT_BYTES: 1073741824
      KAFKA_LOG_DIRS: '/tmp/kraft-combined-logs'
    volumes:
      - kafka_data:/tmp/kraft-combined-logs

  # Cal.com Self-Hosted
  cal-com:
    image: calcom/cal.com:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://cal_user:cal_pass@cal-db:5432/cal_db
      - NEXTAUTH_SECRET=${CAL_NEXTAUTH_SECRET}
      - CALENDSO_ENCRYPTION_KEY=${CAL_ENCRYPTION_KEY}
      - NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000
      - NEXT_PUBLIC_LICENSE_CONSENT=agree
    depends_on:
      - cal-db

  cal-db:
    image: postgres:15
    environment:
      POSTGRES_DB: cal_db
      POSTGRES_USER: cal_user
      POSTGRES_PASSWORD: cal_pass
    volumes:
      - cal_db_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"

volumes:
  nlj_db_data:
  cal_db_data:
  kafka_data:
```

6.2 Environment Variables
Required environment variables for production deployment:

```env
# Cal.com Configuration
CAL_NEXTAUTH_SECRET=your-secure-nextauth-secret-key
CAL_ENCRYPTION_KEY=your-secure-encryption-key

# Kafka Configuration  
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# Database URLs
NLJ_DATABASE_URL=postgresql+asyncpg://nlj_user:nlj_pass@nlj-db:5432/nlj_platform
CAL_DATABASE_URL=postgresql://cal_user:cal_pass@cal-db:5432/cal_db

# Frontend URLs
NEXT_PUBLIC_WEBAPP_URL=https://your-cal-domain.com
VITE_API_URL=https://your-nlj-api-domain.com
```

6.3 Network Configuration
- NLJ Frontend: Port 5173 (development) / 80,443 (production)
- NLJ API: Port 8000 
- Cal.com: Port 3000
- Kafka: Port 9092 (internal), exposed for development
- PostgreSQL instances: 5432 (NLJ), 5433 (Cal.com)

6.4 Volume Management
- Persistent data volumes for both PostgreSQL instances
- Kafka data persistence for event durability
- Separate volume mounts for development vs production

6.5 Production Considerations
- Use Docker secrets for sensitive environment variables
- Configure proper reverse proxy (nginx) for HTTPS termination
- Set up log aggregation for all containers
- Implement health checks for service monitoring
- Configure backup strategies for PostgreSQL volumes

7. Data Model Considerations
7.1 Database Architecture
The implementation uses separate PostgreSQL databases for clean separation of concerns:

NLJ Platform Database (Existing)
- Users with role-based access control (LEARNER, INSTRUCTOR, ADMIN)
- Content items (training scenarios, assessments, games)
- Learning progress and completion tracking
- xAPI event metadata and integration references

Cal.com Database (Self-Hosted)
- Users (synchronized from NLJ via API)
- Event types (training session templates)
- Bookings and availability data
- Calendar integrations and preferences

7.2 Key Entities

NLJ Platform Extensions

Training Session Metadata
- References to Cal.com event type IDs
- Prerequisites linked to NLJ content completion
- Location and capacity requirements
- Instructor assignments and qualifications

Event Integration Tables
- Kafka event tracking and deduplication
- xAPI event metadata and correlation IDs
- Booking status synchronization
- Analytics and reporting aggregations

Learner Preferences
- Preferred training locations and times
- Notification settings and delivery methods
- Learning history and prerequisite completion
- Scheduling preferences and availability


Cal.com Standard Schema
- Standard Cal.com event types for training sessions
- User accounts synchronized with NLJ platform
- Booking records with attendee information
- Calendar integrations (Google, Outlook, Apple)

7.3 Integration Strategy
Rather than shared database access, systems communicate via:
- xAPI events through Kafka for real-time synchronization
- REST API calls for direct operations (booking creation, availability)
- Webhook-to-event bridge for Cal.com booking notifications
- Reference IDs stored in both systems for data correlation

This approach provides:
- Clean separation of concerns and bounded contexts
- Independent scaling and maintenance of each system
- Event-driven real-time synchronization
- Future flexibility for additional system integration


8. Event Architecture & xAPI Integration

8.1 Event-Driven Communication
The integration leverages Kafka as a message broker to enable real-time, event-driven communication between NLJ platform and Cal.com while maintaining loose coupling.

8.2 xAPI Event Schema
All events follow xAPI (Tin Can API) standards for consistency with learning analytics:

Training Session Scheduled Event
```json
{
  "actor": {
    "name": "instructor@company.com",
    "mbox": "mailto:instructor@company.com"
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/scheduled",
    "display": {"en": "scheduled"}
  },
  "object": {
    "id": "training-session-uuid",
    "definition": {
      "name": {"en": "Product Knowledge Training - Level 1"},
      "description": {"en": "Comprehensive product training session"},
      "type": "http://id.tincanapi.com/activitytype/meeting"
    }
  },
  "context": {
    "instructor": {
      "name": "John Instructor",
      "mbox": "mailto:instructor@company.com"
    },
    "extensions": {
      "http://nlj.platform/extensions/cal_event_id": "evt_abc123",
      "http://nlj.platform/extensions/capacity": 20,
      "http://nlj.platform/extensions/location": "Training Center A",
      "http://nlj.platform/extensions/prerequisites": ["content-uuid-1", "content-uuid-2"]
    }
  },
  "timestamp": "2025-01-15T10:00:00Z"
}
```

Learner Registration Event
```json
{
  "actor": {
    "name": "learner@company.com",
    "mbox": "mailto:learner@company.com"
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/registered", 
    "display": {"en": "registered"}
  },
  "object": {
    "id": "training-session-uuid",
    "definition": {
      "name": {"en": "Product Knowledge Training - Level 1"},
      "type": "http://id.tincanapi.com/activitytype/meeting"
    }
  },
  "context": {
    "extensions": {
      "http://nlj.platform/extensions/cal_booking_id": "bkg_xyz789",
      "http://nlj.platform/extensions/scheduled_time": "2025-02-15T10:00:00Z",
      "http://nlj.platform/extensions/registration_method": "online"
    }
  },
  "timestamp": "2025-01-16T14:30:00Z"
}
```

Session Attendance Event
```json
{
  "actor": {
    "name": "learner@company.com",
    "mbox": "mailto:learner@company.com"
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/attended",
    "display": {"en": "attended"}
  },
  "object": {
    "id": "training-session-uuid",
    "definition": {
      "name": {"en": "Product Knowledge Training - Level 1"},
      "type": "http://id.tincanapi.com/activitytype/meeting"
    }
  },
  "result": {
    "completion": true,
    "duration": "PT2H30M",
    "extensions": {
      "http://nlj.platform/extensions/attendance_method": "in_person",
      "http://nlj.platform/extensions/check_in_time": "2025-02-15T09:55:00Z",
      "http://nlj.platform/extensions/check_out_time": "2025-02-15T12:25:00Z"
    }
  },
  "timestamp": "2025-02-15T12:25:00Z"
}
```

8.3 Kafka Topic Organization
Topics organized by domain and event type:

- `nlj.training.scheduled` - Training sessions created/updated
- `nlj.training.registration` - Learner registration events  
- `nlj.training.attendance` - Session attendance tracking
- `nlj.training.completion` - Session completion and outcomes
- `cal.booking.created` - Cal.com booking webhooks
- `cal.booking.cancelled` - Cal.com cancellation webhooks
- `cal.booking.rescheduled` - Cal.com reschedule webhooks

8.4 Event Flow Patterns

Session Creation Flow
1. Instructor creates training session in NLJ platform
2. NLJ publishes `nlj.training.scheduled` event to Kafka
3. Cal.com integration service consumes event
4. Cal.com service creates corresponding event type via API
5. Cal.com service publishes confirmation event with Cal.com IDs

Registration Flow  
1. Learner registers via NLJ frontend
2. NLJ checks prerequisites and availability
3. NLJ calls Cal.com API to create booking
4. Cal.com webhook triggers booking confirmation
5. Webhook service publishes `nlj.training.registration` event
6. NLJ consumes event and updates internal state

Attendance Tracking Flow
1. Instructor marks attendance in Cal.com or NLJ
2. Attendance event published to Kafka
3. Both systems update their records
4. Analytics services consume events for reporting

8.5 Error Handling & Reliability
- Event retry mechanisms with exponential backoff
- Dead letter queues for failed event processing
- Event deduplication using correlation IDs
- Schema validation for all published events
- Monitoring and alerting for event processing failures

8.6 Future LRS Integration
The event architecture is designed for easy integration with Learning Record Stores:
- LRS becomes another Kafka consumer
- All xAPI events automatically flow to LRS
- Historical event replay capability for LRS population
- Complex event processing for advanced learning analytics

9. User Experience Design
9.1 Learner Journey

Discovery: Browse or search for required training
Selection: View details and check availability
Registration: Simple booking or alternative selection
Confirmation: Immediate feedback and calendar integration
Reminder: Automated notifications before session
Attendance: Check-in and completion tracking

7.2 Mobile Considerations

Touch-optimized interfaces
Offline capability for viewing schedules
Push notifications for reminders
Responsive design for all screen sizes

7.3 Accessibility Requirements

WCAG 2.1 AA compliance
Screen reader compatibility
Keyboard navigation support
High contrast mode options


8. Security and Compliance
8.1 Data Protection

Encrypt sensitive data at rest and in transit
Implement proper access controls
Audit trail for all booking changes
GDPR compliance for data retention

8.2 Authentication and Authorization

SSO integration with existing system
Role-based access control (RBAC)
Session management
API key security for Cal.com integration


9. Performance Requirements
9.1 Response Time Targets

Page load: < 2 seconds
Search results: < 1 second
Booking confirmation: < 3 seconds
Report generation: < 5 seconds

9.2 Scalability Considerations

Support 10,000+ concurrent users
Handle 1,000+ bookings per hour
Maintain performance with 1M+ historical records


10. Success Metrics
10.1 Key Performance Indicators
MetricTargetMeasurement MethodRegistration completion rate> 90%Funnel analysisAlternative acceptance rate> 60%Suggestion trackingNo-show rate< 10%Attendance recordsMobile usage> 40%Analytics trackingSystem uptime> 99.9%Monitoring tools
10.2 User Satisfaction Metrics

User satisfaction score: > 4/5
Support ticket volume: < 5% of users
Feature adoption rate: > 80% within 3 months


11. Risk Mitigation
11.1 Technical Risks
RiskMitigation StrategyCal.com limitationsBuild abstraction layer for future flexibilityPerformance degradationImplement caching and query optimizationIntegration failuresDesign with fallback mechanismsData inconsistencyImplement transaction management
11.2 Business Risks
RiskMitigation StrategyLow user adoptionPhased rollout with trainingCompliance violationsRegular audit proceduresChange resistanceClear communication and support

12. Implementation Timeline
12.1 Milestone Schedule

Weeks 1-2: Foundation and infrastructure
Weeks 3-4: Core scheduling features
Weeks 5-6: AI enhancements
Weeks 7-8: Notifications and reporting
Weeks 9-10: Testing and deployment
Week 11: Production launch
Week 12: Post-launch support and optimization

12.2 Resource Requirements

1 Full-stack developer (primary)
1 Frontend developer (UI/UX focus)
1 DevOps engineer (part-time)
1 QA engineer (weeks 8-10)
1 Project manager (coordination)


13. Future Roadmap & Evolution

13.1 Learning Record Store (LRS) Integration
The event-driven architecture provides a natural foundation for LRS integration:

Phase 1: Basic LRS Consumer
- Deploy LRS as additional Kafka consumer
- Automatic ingestion of all xAPI training events
- Historical event replay for data population
- Basic learning analytics and reporting

Phase 2: Advanced Analytics
- Complex event stream processing
- Real-time learning analytics dashboards
- Predictive modeling for training effectiveness
- Personalized learning path recommendations

Phase 3: Multi-System Integration
- Additional learning systems as Kafka producers/consumers
- Unified learning analytics across all platforms
- Enterprise-wide learning data warehouse
- Advanced reporting and compliance tracking

13.2 Scaling Considerations

Kafka Infrastructure Evolution
- Single-node MVP → Multi-node cluster for production
- Auto-scaling based on event volume
- Multi-region deployment for disaster recovery
- Stream processing with Kafka Streams or Apache Flink

Cal.com Customization
- Custom branding and UI themes
- Enhanced integration with NLJ user roles
- Advanced scheduling algorithms
- Custom calendar integrations

13.3 Advanced Features Roadmap
- AI-powered session recommendations based on learning history
- Automated prerequisite checking and enrollment workflows
- Integration with video conferencing platforms for hybrid sessions
- Mobile app development for native scheduling experience
- Advanced reporting with ML-driven insights

13.4 Technical Evolution
- Migration from API-based to fully event-driven integration
- Microservices architecture with dedicated scheduling service
- GraphQL API layer for flexible frontend integrations
- Serverless event processing for cost optimization

14. Open Questions for Development Team

Authentication Strategy

Current SSO implementation details?
How to bridge Cal.com authentication with existing system?


Infrastructure

Preferred cloud provider or on-premise requirements?
Current Docker orchestration platform?


Notifications

Existing email/SMS services in use?
Preference for notification delivery methods?


Data Migration

Volume of historical training data to migrate?
Existing session/scheduling data format?


Compliance

Specific GDPR requirements for training data?
Data retention policies currently in place?


Integration

Existing APIs that need to be maintained?
Current webhook patterns in use?



