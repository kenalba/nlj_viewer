# Cal.com Integration - Phase 1 Implementation

This document outlines the Phase 1 implementation of Cal.com integration with the NLJ Platform, providing event-driven in-person training scheduling capabilities.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### Development Setup

1. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your configuration
   # Required variables:
   # - CAL_NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
   # - CAL_ENCRYPTION_KEY (generate with: openssl rand -base64 32)
   ```

2. **Start Infrastructure Services**
   ```bash
   # Start databases, Kafka (KRaft mode), and Cal.com
   docker-compose up -d nlj-db kafka cal-db cal-com
   
   # Optional: Start Kafka UI for development
   docker-compose --profile dev-tools up -d kafka-ui
   ```

3. **Start NLJ Backend**
   ```bash
   # Option 1: Using Docker (recommended)
   docker-compose up -d nlj-api
   
   # Option 2: Local development
   cd backend
   pip install -e ".[dev]"
   uvicorn app.main:app --reload
   ```

4. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Service URLs
- **NLJ Frontend**: http://localhost:5173
- **NLJ API**: http://localhost:8000
- **Cal.com**: http://localhost:3000
- **Kafka UI**: http://localhost:8080 (if dev-tools profile enabled)
- **API Documentation**: http://localhost:8000/docs

## 🏗️ Architecture Overview

### Event-Driven Design
```
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
```

### Key Components

1. **NLJ Platform**: Existing learning management system
2. **Cal.com**: Self-hosted scheduling system
3. **Apache Kafka**: Event streaming platform (KRaft mode, no Zookeeper)
4. **PostgreSQL**: Separate databases for clean separation
5. **xAPI Events**: Learning analytics standard for event tracking

## 📊 Database Schema

### New Tables Added

#### `training_sessions`
Core training session metadata linking NLJ content with Cal.com events.

#### `training_instances` 
Specific scheduled occurrences of training sessions.

#### `training_bookings`
Individual learner registrations and bookings.

#### `attendance_records`
Attendance tracking and completion data.

#### `xapi_event_log`
Audit trail of published xAPI events.

## 🔄 Event Flow Patterns

### Session Creation
1. Instructor creates training session in NLJ platform
2. NLJ publishes `nlj.training.scheduled` event to Kafka
3. Cal.com integration service consumes event
4. Cal.com service creates corresponding event type via API

### Registration Flow
1. Learner registers via NLJ frontend
2. NLJ checks prerequisites and availability
3. NLJ calls Cal.com API to create booking
4. Cal.com webhook triggers booking confirmation
5. Webhook service publishes `nlj.training.registration` event
6. NLJ consumes event and updates internal state

### Kafka Topics
- `nlj.training.scheduled` - Training sessions created/updated
- `nlj.training.registration` - Learner registration events  
- `nlj.training.attendance` - Session attendance tracking
- `nlj.training.completion` - Session completion and outcomes
- `cal.booking.created` - Cal.com booking webhooks
- `cal.booking.cancelled` - Cal.com cancellation webhooks
- `cal.booking.rescheduled` - Cal.com reschedule webhooks

## 🔌 API Endpoints

### Cal.com Integration
- `POST /api/webhooks/calcom/booking` - Webhook receiver for Cal.com events
- `GET /api/calcom/health` - Health check for integration
- `GET /api/calcom/topics` - List available Kafka topics

### Webhook Security
Webhooks are secured using HMAC SHA256 signatures. Configure `CAL_COM_WEBHOOK_SECRET` in your environment.

## 🛠️ Development Tools

### Kafka Management
```bash
# View Kafka UI
open http://localhost:8080

# Monitor topics (if kafka-python tools available)
kafka-console-consumer --bootstrap-server localhost:9092 --topic nlj.training.scheduled --from-beginning
```

### Database Migrations
```bash
cd backend
# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "Description"
```

### Testing Webhooks
```bash
# Test webhook endpoint
curl -X POST http://localhost:8000/api/webhooks/calcom/booking \
  -H "Content-Type: application/json" \
  -d '{
    "triggerEvent": "BOOKING_CREATED",
    "createdAt": "2025-08-05T12:00:00Z",
    "payload": {
      "id": 123,
      "uid": "test-booking-uid",
      "title": "Product Training Session",
      "startTime": "2025-08-15T10:00:00Z",
      "endTime": "2025-08-15T12:00:00Z",
      "attendees": [{"email": "learner@example.com", "name": "Test Learner"}],
      "organizer": {"email": "instructor@example.com", "name": "Test Instructor"},
      "status": "confirmed",
      "eventTypeId": 1
    }
  }'
```

## 📋 Phase 1 Completion Status

### ✅ Completed
- [x] Docker Compose configuration for all services
- [x] Environment variables and secrets configuration  
- [x] Kafka client integration in FastAPI backend
- [x] Database schema extensions for training metadata
- [x] xAPI event producer/consumer setup
- [x] Webhook-to-Kafka bridge endpoints
- [x] Development environment validation

### 🔄 Next Steps (Phase 2)
- [ ] Cal.com event type configuration
- [ ] Basic scheduling UI components
- [ ] Registration flow implementation
- [ ] Real-time availability checking
- [ ] Prerequisites integration

## 🚨 Troubleshooting

### Common Issues

#### Kafka Connection Errors
```bash
# Check Kafka status
docker-compose logs kafka

# Verify Kafka is accessible
docker exec -it nlj_kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

#### Cal.com Setup Issues
```bash
# Check Cal.com logs
docker-compose logs cal-com

# Verify database connection
docker exec -it cal_postgres pg_isready -U cal_user -d cal_db
```

#### Database Migration Issues
```bash
# Check current migration status
cd backend && alembic current

# Reset migrations (development only)
alembic downgrade base && alembic upgrade head
```

## 📖 Additional Resources

- [Cal.com Documentation](https://cal.com/docs)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [xAPI Specification](https://github.com/adlnet/xAPI-Spec)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

**Phase 1 Status**: ✅ **COMPLETE** - Ready for Phase 2 implementation