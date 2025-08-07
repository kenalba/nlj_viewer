# Ralph LRS + Elasticsearch Analytics Integration

This document describes the comprehensive learning analytics system built with Ralph LRS (Learning Record Store) and Elasticsearch for the NLJ Platform.

## 🎯 Architecture Overview

```
Frontend xAPI Events → Kafka Event Bus → Ralph LRS → Elasticsearch
                                            ↓
Custom Analytics Dashboard ← FastAPI Analytics Service ← Elasticsearch
```

### Key Components

1. **Ralph LRS** - ADL-certified xAPI 1.0.3 compliant Learning Record Store
2. **Elasticsearch** - Analytics engine for fast queries and aggregations
3. **Kafka Consumer** - Event pipeline from Kafka topics to Ralph LRS
4. **Analytics API** - FastAPI endpoints for dashboard data
5. **Analytics Dashboard** - Custom React components with MUI X Charts

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### Starting the Analytics Services

```bash
# Start all services including analytics
docker-compose -f docker-compose.yml -f docker-compose.analytics.yml up

# Or start individual services
docker-compose up elasticsearch ralph-lrs
```

### Service URLs

- **Ralph LRS**: http://localhost:8100
- **Elasticsearch**: http://localhost:9200
- **Analytics Dashboard**: http://localhost:5173/app/analytics (admin only)

## 📊 Analytics Dashboard Features

### Platform Overview
- Total learners and activities
- Completion rates and engagement metrics
- Daily activity timeline (Line Chart)
- System health status

### Activity Trends
- Activity trends over time (Bar Chart)
- Period selection (1 day to 1 year)
- Summary statistics

### Learner Analytics
- Individual learner progress tracking
- Learning streaks and completion rates
- Recent activity summaries

### Performance Metrics
- System health monitoring
- Ralph LRS and Elasticsearch status
- Export capabilities (JSON format)

## 🔧 Configuration

### Environment Variables

Backend (`docker-compose.yml`):
```yaml
# Ralph LRS Configuration
- RALPH_LRS_URL=http://ralph-lrs:8100
- RALPH_LRS_USERNAME=nlj-platform
- RALPH_LRS_SECRET=nlj-secure-secret-2024

# Elasticsearch Configuration  
- ELASTICSEARCH_URL=http://elasticsearch:9200
- ELASTICSEARCH_INDEX=nlj-xapi-statements
```

### Ralph LRS Authentication

Configure in `config/ralph/auth.json`:
```json
{
  "agents": [
    {
      "username": "nlj-platform",
      "password": "nlj-secure-secret-2024",
      "scopes": ["statements/write", "statements/read", "activities/read"]
    }
  ]
}
```

## 📡 API Endpoints

### Analytics Health Check
```http
GET /api/analytics/health
```
Returns status of Ralph LRS and Elasticsearch services.

### Platform Overview
```http
GET /api/analytics/overview?since=2024-01-01&until=2024-12-31
```
Get platform-wide analytics with optional date filters.

### Learner Analytics
```http
GET /api/analytics/learner/{email}?since=2024-01-01
```
Get comprehensive analytics for a specific learner.

### Activity Analytics
```http
GET /api/analytics/activity/{activity_id}?since=2024-01-01
```
Get analytics for a specific activity.

### Trends Analysis
```http
GET /api/analytics/trends?period=7d&metric=completion
```
Get analytics trends over specified periods.

### Data Export
```http
GET /api/analytics/export/json?data_type=overview
```
Export analytics data in JSON format.

## 🔄 Event Processing Pipeline

### xAPI Event Flow
1. Frontend generates xAPI events from user interactions
2. Events are published to Kafka topics
3. Kafka Ralph Consumer processes events
4. Events are validated and transformed to xAPI 1.0.3 format
5. Ralph LRS stores events in Elasticsearch
6. Analytics API queries Elasticsearch for dashboard data

### Supported Event Types

- **Training Programs**: program.created, program.published
- **Training Sessions**: session.scheduled, session.cancelled
- **Bookings**: booking.requested, booking.confirmed, booking.waitlisted
- **Attendance**: attendance.checked_in, attendance.completed
- **Certificates**: certificate.earned
- **Activity Events**: All frontend learning activity interactions

## 🛠 Development

### Backend Services

Key files:
- `backend/app/services/ralph_lrs_service.py` - Ralph LRS integration
- `backend/app/services/elasticsearch_service.py` - Direct Elasticsearch queries
- `backend/app/services/kafka_ralph_consumer.py` - Event pipeline consumer
- `backend/app/api/analytics.py` - Analytics API endpoints

### Frontend Components

Key files:
- `frontend/components/dashboards/AnalyticsDashboard.tsx` - Main dashboard
- `frontend/shared/SidebarNavigation.tsx` - Navigation integration (admin only)
- `frontend/App.tsx` - Route handling

### Adding New Analytics

1. **Backend**: Add new endpoints to `backend/app/api/analytics.py`
2. **Elasticsearch**: Extend queries in `elasticsearch_service.py`
3. **Frontend**: Add new dashboard tabs or components
4. **Charts**: Use MUI X Charts for consistency

## 🧪 Testing

### Manual Testing

1. **Service Health**:
   ```bash
   # Test Ralph LRS
   curl http://localhost:8100/xAPI/about
   
   # Test Elasticsearch
   curl http://localhost:9200/_cluster/health
   ```

2. **Analytics API**:
   ```bash
   # Get platform overview (requires auth token)
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8000/api/analytics/overview
   ```

3. **Dashboard Access**:
   - Login as admin user
   - Navigate to http://localhost:5173/app/analytics
   - Verify charts and data display

### Creating Test Data (Future)

A future backlog item will create a fake data generator script to populate the system with meaningful learning analytics data for testing and demonstration purposes.

## 🔒 Security & Permissions

### Access Control
- Analytics dashboard: **Admin users only**
- Analytics API: **Role-based access** (learners can view own data)
- Ralph LRS: **Basic auth** with scoped permissions
- Elasticsearch: **Internal network only** (no external access)

### Data Privacy
- Personal data is stored in xAPI compliant format
- Learner email addresses are used as identifiers
- Individual analytics require proper authorization

## 📈 Performance Considerations

### Elasticsearch Optimization
- Single node configuration for development
- Index mapping optimized for analytics queries
- Configurable chunk sizes for read/write operations

### Caching Strategy
- Ralph LRS includes built-in statement caching
- Frontend implements client-side data caching
- API responses include appropriate cache headers

### Monitoring
- Health check endpoints for all services
- Real-time system status in dashboard
- Error handling with graceful degradation

## 🔮 Future Enhancements

### Analytics Features
- Real-time dashboard updates
- More chart types (Pie charts, Scatter plots)
- Advanced filtering and drill-down capabilities
- Automated report generation

### Data Pipeline
- Stream processing for real-time analytics
- Data retention and archival policies
- Advanced machine learning insights

### Integration
- Integration with external LMS systems
- SCORM compliance tracking
- Advanced learner journey mapping

## 🆘 Troubleshooting

### Common Issues

1. **Ralph LRS Connection Failed**
   - Check if ralph-lrs container is running
   - Verify authentication credentials
   - Check network connectivity between services

2. **Elasticsearch Connection Failed**
   - Ensure elasticsearch container has sufficient memory
   - Check cluster health status
   - Verify index exists and is accessible

3. **Empty Analytics Dashboard**
   - Check if Kafka consumer is processing events
   - Verify xAPI events are being generated
   - Check Elasticsearch for stored statements

4. **Permission Denied**
   - Ensure user has admin role for analytics access
   - Check authentication token validity
   - Verify API endpoint permissions

### Logs and Debugging

```bash
# View service logs
docker-compose logs ralph-lrs
docker-compose logs elasticsearch
docker-compose logs nlj-api

# Check Kafka consumer status
docker-compose logs nlj-api | grep "kafka"

# Monitor Elasticsearch indices
curl http://localhost:9200/_cat/indices?v
```

## 📄 Standards Compliance

### xAPI 1.0.3 Compliance
- All events follow xAPI statement structure
- Proper actor, verb, object, result, and context formatting
- ADL-certified Ralph LRS ensures standards compliance

### Learning Analytics Standards
- Follows learning analytics best practices
- Supports common learning analytics use cases
- Extensible for custom analytics requirements

---

For questions or issues, please check the main project README or create an issue in the repository.