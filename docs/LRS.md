# Learning Record Store (LRS) Integration Plan

## Overview

The NLJ Viewer platform already has a **comprehensive xAPI 1.0.3 implementation** with 1,200+ lines of production-ready code including full event tracking, statement building, validation, and export capabilities. This document outlines a **decoupled, Kafka-first approach** for enterprise-grade learning analytics while keeping the core application lightweight and LRS-agnostic.

## Current xAPI Foundation (Already Built ✅)

### Existing Implementation
- **Complete xAPI Types** (`frontend/xapi/types.ts`) - 462 lines of xAPI 1.0.3 interfaces
- **Statement Builder** (`frontend/xapi/builder.ts`) - 648 lines with fluent API and validation
- **Event Tracking Context** (`frontend/contexts/XAPIContext.tsx`) - 1,099 lines of comprehensive tracking
- **Results Display** (`frontend/player/XAPIResultsScreen.tsx`) - Analytics and export capabilities

### Current Event Tracking Capabilities
```typescript
// Activity Lifecycle
- trackActivityLaunched/Completed/Suspended/Resumed

// Question Interactions  
- trackQuestionAnswered/Skipped with performance metrics

// Survey Responses
- trackSurveyStarted/Completed/Response with section support

// Game Tracking
- trackConnectionsGame* (full NYT-style word puzzle lifecycle)
- trackWordleGame* (complete word guessing game tracking)

// Navigation
- trackNodeVisited for learning path analytics
```

### Enterprise Features Already Available
- Session management with UUID generation
- Statement validation and error handling
- Multiple export formats (JSON, CSV)
- Mock client for development
- Extensible architecture for new interaction types
- Custom verb definitions for specialized learning activities

## Recommended Architecture: Decoupled Event-Driven LRS

### **Core Principle: Separation of Concerns**
The NLJ application focuses on learning experiences while external services handle LRS compliance, analytics, and data storage.

```
NLJ Frontend (xAPI) → FastAPI → Generic Event Publisher → Kafka Event Bus → [Multiple Consumers]
                                                              ↓
                                                          Ralph LRS Consumer → Elasticsearch
                                                              ↓
                                                          Analytics Consumer → PostgreSQL
                                                              ↓
                                                          [Other Consumers] → [Other Systems]
```

### **Benefits of This Approach**
- **Lightweight Application** - No LRS-specific dependencies in main app
- **LRS Vendor Independence** - Can switch between Ralph, SCORM Cloud, Watershed, etc.
- **Enterprise Integration** - Fits naturally into organizational event architecture
- **Operational Independence** - LRS can scale/fail without affecting main application
- **Future-Proof** - Easy to add new consumers (recommendations, compliance, reporting)

---

# Implementation Plan: Decoupled Kafka-First LRS (2 weeks)

## Week 1: Core Event Publishing Architecture

### Day 1-2: Generic xAPI Publisher Abstraction

**Create Publisher Interface:**
```python
# backend/app/services/xapi_publisher.py
from abc import ABC, abstractmethod
from typing import Dict, Any, List
import asyncio

class XAPIPublisher(ABC):
    @abstractmethod
    async def publish_statement(self, statement: Dict[str, Any]) -> bool:
        """Publish xAPI statement to configured backend"""
        pass

class KafkaPublisher(XAPIPublisher):
    """Kafka event publisher for enterprise event bus"""
    def __init__(self, bootstrap_servers: str, topic: str):
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.producer = None
    
    async def start(self):
        from aiokafka import AIOKafkaProducer
        self.producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda x: json.dumps(x, default=str).encode('utf-8'),
            key_serializer=lambda x: x.encode('utf-8') if x else None
        )
        await self.producer.start()
    
    async def publish_statement(self, statement: Dict[str, Any]) -> bool:
        if not self.producer:
            await self.start()
        
        # Extract user ID for partitioning (ensures event ordering per user)
        actor_key = self.extract_actor_key(statement)
        
        event_data = {
            'statement': statement,
            'source': 'nlj-viewer',
            'timestamp': datetime.utcnow().isoformat(),
            'schema_version': '1.0.3',
            'event_type': 'xapi_statement'
        }
        
        try:
            await self.producer.send(
                topic=self.topic,
                value=event_data,
                key=actor_key
            )
            return True
        except Exception as e:
            logger.error(f"Failed to publish to Kafka: {e}")
            return False
    
    def extract_actor_key(self, statement: Dict[str, Any]) -> str:
        """Extract user identifier for Kafka partitioning"""
        actor = statement.get('actor', {})
        if 'account' in actor:
            return actor['account'].get('name', 'anonymous')
        elif 'mbox' in actor:
            return actor['mbox'].replace('mailto:', '')
        return 'anonymous'

class HTTPLRSPublisher(XAPIPublisher):
    """Generic HTTP LRS publisher (works with any xAPI-compliant LRS)"""
    def __init__(self, endpoint: str, username: str, password: str):
        self.endpoint = endpoint
        self.username = username
        self.password = password
    
    async def publish_statement(self, statement: Dict[str, Any]) -> bool:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.endpoint}/statements",
                    json=statement,
                    auth=(self.username, self.password),
                    headers={"X-Experience-API-Version": "1.0.3"}
                )
                return response.status_code == 200
            except Exception as e:
                logger.error(f"HTTP LRS publish failed: {e}")
                return False

class MultiPublisher(XAPIPublisher):
    """Publish to multiple backends simultaneously"""
    def __init__(self, publishers: List[XAPIPublisher]):
        self.publishers = publishers
    
    async def publish_statement(self, statement: Dict[str, Any]) -> bool:
        results = await asyncio.gather(
            *[pub.publish_statement(statement) for pub in self.publishers],
            return_exceptions=True
        )
        # Success if any publisher succeeds
        success_count = sum(1 for r in results if r is True)
        return success_count > 0

class MockPublisher(XAPIPublisher):
    """Mock publisher for development and testing"""
    async def publish_statement(self, statement: Dict[str, Any]) -> bool:
        verb = statement.get('verb', {}).get('display', {}).get('en-US', 'unknown')
        actor = statement.get('actor', {}).get('name', 'anonymous')
        logger.info(f"Mock xAPI: {actor} {verb}")
        return True
```

**Configuration Management:**
```python
# backend/app/core/config.py
class Settings(BaseSettings):
    # xAPI Publisher Configuration
    XAPI_PUBLISHER_TYPE: str = "kafka"  # "kafka", "http", "multi", "mock"
    
    # Kafka Configuration
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"
    KAFKA_XAPI_TOPIC: str = "nlj.xapi.statements"
    
    # HTTP LRS Configuration (fallback/alternative)
    XAPI_LRS_ENDPOINT: str = ""
    XAPI_LRS_USERNAME: str = ""
    XAPI_LRS_PASSWORD: str = ""

# Factory function
def get_xapi_publisher() -> XAPIPublisher:
    """Factory function for xAPI publisher based on configuration"""
    settings = get_settings()
    
    if settings.XAPI_PUBLISHER_TYPE == "kafka":
        return KafkaPublisher(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            topic=settings.KAFKA_XAPI_TOPIC
        )
    elif settings.XAPI_PUBLISHER_TYPE == "http":
        return HTTPLRSPublisher(
            endpoint=settings.XAPI_LRS_ENDPOINT,
            username=settings.XAPI_LRS_USERNAME,
            password=settings.XAPI_LRS_PASSWORD
        )
    elif settings.XAPI_PUBLISHER_TYPE == "multi":
        # Publish to both Kafka and HTTP LRS
        return MultiPublisher([
            KafkaPublisher(settings.KAFKA_BOOTSTRAP_SERVERS, settings.KAFKA_XAPI_TOPIC),
            HTTPLRSPublisher(settings.XAPI_LRS_ENDPOINT, settings.XAPI_LRS_USERNAME, settings.XAPI_LRS_PASSWORD)
        ])
    else:
        return MockPublisher()
```

### Day 3-4: Backend API Integration

**Ultra-Light API Endpoint:**
```python
# backend/app/api/xapi.py - Now completely LRS-agnostic
from fastapi import APIRouter, HTTPException
from app.services.xapi_publisher import get_xapi_publisher

router = APIRouter(prefix="/api/xapi", tags=["xAPI"])

@router.post("/statements")
async def publish_xapi_statement(statement: dict):
    """Generic xAPI statement publisher - works with any LRS backend"""
    try:
        publisher = get_xapi_publisher()
        success = await publisher.publish_statement(statement)
        
        if success:
            return {"success": True, "message": "Statement published successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to publish statement")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def xapi_health_check():
    """Health check for xAPI publishing system"""
    try:
        publisher = get_xapi_publisher()
        # Could add publisher-specific health checks here
        return {"status": "healthy", "publisher_type": type(publisher).__name__}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
```

**Frontend Integration (No Changes Required!):**
```typescript
// frontend/contexts/XAPIContext.tsx - Existing code works unchanged!
const trackEvent = useCallback((event: LearningActivityEvent | QuestionEvent | ...) => {
  if (!isEnabled || !actor) return;
  
  try {
    // ... existing statement creation logic (unchanged) ...
    
    // Update local state (keep existing)
    setStatements(prev => [...prev, statement]);
    setTotalEvents(prev => prev + 1);
    setLastEventTime(new Date());
    
    // Send to publisher - same endpoint, now LRS-agnostic!
    fetch('/api/xapi/statements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statement)
    }).catch(error => {
      console.error('Failed to send statement:', error);
    });
    
  } catch (error) {
    console.error('Failed to create xAPI statement:', error);
  }
}, [isEnabled, actor]);
```

### Day 5: Kafka Infrastructure Setup

**Docker Compose for Development:**
```yaml
# docker-compose.yml - Add to existing services
services:
  # ... existing services (postgres, nlj-backend, nlj-frontend) ...
  
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zk_data:/var/lib/zookeeper/data

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_NUM_PARTITIONS: 3  # Allow parallel processing
      KAFKA_LOG_RETENTION_HOURS: 168  # 7 days retention
    volumes:
      - kafka_data:/var/lib/kafka/data

  # Kafka UI for development (optional)
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092

volumes:
  zk_data:
  kafka_data:
```

**Topic Initialization:**
```python
# backend/app/services/kafka_setup.py
from aiokafka.admin import AIOKafkaAdminClient, NewTopic

async def create_xapi_topics():
    """Create necessary Kafka topics for xAPI events"""
    admin_client = AIOKafkaAdminClient(
        bootstrap_servers="kafka:9092"
    )
    
    topics = [
        NewTopic(
            name="nlj.xapi.statements",
            num_partitions=3,
            replication_factor=1,
            config={
                "retention.ms": "604800000",  # 7 days
                "cleanup.policy": "delete"
            }
        ),
        NewTopic(
            name="nlj.analytics.events",
            num_partitions=3,
            replication_factor=1
        )
    ]
    
    try:
        await admin_client.create_topics(topics)
        logger.info("Created xAPI Kafka topics")
    except Exception as e:
        logger.warning(f"Topics may already exist: {e}")
    finally:
        await admin_client.close()
```

## Week 2: External LRS Consumers & Analytics

### Day 1-2: Ralph LRS Consumer Service

**Separate Ralph Consumer (Not in Main App):**
```python
# consumers/ralph_lrs_consumer.py - Separate service/container
from aiokafka import AIOKafkaConsumer
import json
import asyncio
from ralph.backends.lrs import LRS
from ralph.models.xapi import BaseXapiModel

class RalphLRSConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            'nlj.xapi.statements',
            bootstrap_servers=['kafka:9092'],
            group_id='ralph-lrs-consumer',
            auto_offset_reset='earliest',
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        
        # Ralph LRS setup
        self.lrs = LRS(
            backends=["es"],
            es_hosts=["elasticsearch:9200"],
            es_index="nlj_statements"
        )
    
    async def start_consuming(self):
        """Start consuming xAPI statements from Kafka"""
        await self.consumer.start()
        logger.info("Ralph LRS Consumer started")
        
        try:
            async for message in self.consumer:
                await self.process_statement(message)
        finally:
            await self.consumer.stop()
    
    async def process_statement(self, message):
        """Process individual xAPI statement"""
        try:
            event_data = message.value
            statement = event_data['statement']
            
            # Validate with Ralph's xAPI model
            validated = BaseXapiModel(**statement)
            
            # Store in Elasticsearch via Ralph
            result = await self.lrs.put_statement(validated.dict())
            
            logger.info(f"Stored statement in Ralph LRS: {statement.get('id')}")
            
        except Exception as e:
            logger.error(f"Failed to process statement: {e}")
            # Could implement dead letter queue for failed statements

if __name__ == "__main__":
    consumer = RalphLRSConsumer()
    asyncio.run(consumer.start_consuming())
```

**Separate Docker Compose for LRS Infrastructure:**
```yaml
# lrs-infrastructure.yml - Separate from main app
version: '3.8'
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
      - xpack.security.enabled=false
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  ralph-consumer:
    build:
      context: .
      dockerfile: Dockerfile.ralph-consumer
    depends_on:
      elasticsearch:
        condition: service_healthy
    environment:
      - KAFKA_BOOTSTRAP_SERVERS=host.docker.internal:9092  # Connect to main app's Kafka
      - ELASTICSEARCH_HOSTS=elasticsearch:9200
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

volumes:
  es_data:
```

### Day 3-4: Analytics Consumer for PostgreSQL

**Analytics Consumer (Can run in main app or separately):**
```python
# backend/consumers/analytics_consumer.py
from aiokafka import AIOKafkaConsumer
import json
from datetime import datetime, timedelta

class AnalyticsConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            'nlj.xapi.statements',
            bootstrap_servers=['kafka:9092'],
            group_id='nlj-analytics-consumer',
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        self.db = get_database()
    
    async def start_consuming(self):
        """Start consuming for real-time analytics"""
        await self.consumer.start()
        logger.info("Analytics Consumer started")
        
        try:
            async for message in self.consumer:
                await self.process_analytics(message.value)
        finally:
            await self.consumer.stop()
    
    async def process_analytics(self, event_data):
        """Process statement for immediate analytics updates"""
        statement = event_data['statement']
        verb_id = statement['verb']['id']
        actor = statement['actor']
        
        # Extract user and activity IDs
        user_id = self.extract_user_id(actor)
        activity_id = self.extract_activity_id(statement['object'])
        
        # Route to appropriate analytics processor
        if verb_id.endswith('/answered'):
            await self.update_question_analytics(statement, user_id, activity_id)
        elif verb_id.endswith('/completed'):
            await self.update_completion_analytics(statement, user_id, activity_id)
        elif verb_id.endswith('/launched'):
            await self.update_engagement_analytics(statement, user_id, activity_id)
        
        # Update real-time user progress
        await self.update_user_progress_summary(user_id, activity_id)
    
    async def update_question_analytics(self, statement, user_id, activity_id):
        """Update question-level performance metrics"""
        question_id = statement['object']['id']
        is_correct = statement.get('result', {}).get('success', False)
        response_time = self.extract_response_time(statement)
        
        # Update question performance table
        await self.db.execute("""
            INSERT INTO question_performance (question_id, activity_id, total_attempts, correct_attempts, total_response_time)
            VALUES ($1, $2, 1, $3, $4)
            ON CONFLICT (question_id, activity_id) 
            DO UPDATE SET 
                total_attempts = question_performance.total_attempts + 1,
                correct_attempts = question_performance.correct_attempts + $3,
                total_response_time = question_performance.total_response_time + $4,
                updated_at = NOW()
        """, question_id, activity_id, 1 if is_correct else 0, response_time or 0)
    
    async def update_user_progress_summary(self, user_id, activity_id):
        """Update user progress summary in real-time"""
        # Calculate current progress from recent events
        progress_data = await self.calculate_user_progress(user_id, activity_id)
        
        await self.db.execute("""
            INSERT INTO user_activity_summaries (user_id, activity_id, questions_answered, questions_correct, last_accessed)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id, activity_id)
            DO UPDATE SET
                questions_answered = $3,
                questions_correct = $4,
                last_accessed = NOW(),
                updated_at = NOW()
        """, user_id, activity_id, progress_data['answered'], progress_data['correct'])
```

### Day 5: Integration Testing & Monitoring

**End-to-End Testing:**
```python
# tests/test_xapi_integration.py
import pytest
import asyncio
from tests.fixtures import test_xapi_statement

@pytest.mark.asyncio
async def test_xapi_kafka_flow():
    """Test complete xAPI flow: Frontend → API → Kafka → Consumers"""
    
    # 1. Send statement to API
    response = await test_client.post("/api/xapi/statements", json=test_xapi_statement)
    assert response.status_code == 200
    
    # 2. Verify statement appears in Kafka
    await asyncio.sleep(1)  # Allow processing time
    kafka_messages = await consume_test_messages("nlj.xapi.statements")
    assert len(kafka_messages) == 1
    assert kafka_messages[0]['statement']['id'] == test_xapi_statement['id']
    
    # 3. Verify analytics processing (if analytics consumer running)
    await asyncio.sleep(2)  # Allow analytics processing
    user_progress = await db.fetch_one(
        "SELECT * FROM user_activity_summaries WHERE user_id = $1", 
        test_user_id
    )
    assert user_progress is not None

@pytest.mark.asyncio
async def test_publisher_fallback():
    """Test publisher fallback when Kafka is down"""
    # Configure HTTP fallback publisher
    with mock.patch('app.core.config.get_settings') as mock_settings:
        mock_settings.return_value.XAPI_PUBLISHER_TYPE = "http"
        mock_settings.return_value.XAPI_LRS_ENDPOINT = "http://backup-lrs:8100"
        
        response = await test_client.post("/api/xapi/statements", json=test_xapi_statement)
        assert response.status_code == 200
```

**Monitoring Dashboard:**
```python
# backend/app/api/monitoring.py
@router.get("/xapi/metrics")
async def get_xapi_metrics():
    """Get xAPI publishing and processing metrics"""
    
    # Kafka topic metrics
    kafka_metrics = await get_kafka_topic_metrics("nlj.xapi.statements")
    
    # Analytics processing metrics  
    analytics_metrics = await db.fetch_one("""
        SELECT 
            COUNT(*) as total_statements_processed,
            COUNT(DISTINCT user_id) as active_users,
            MAX(updated_at) as last_processed
        FROM user_activity_summaries 
        WHERE updated_at > NOW() - INTERVAL '24 hours'
    """)
    
    return {
        "kafka": kafka_metrics,
        "analytics": dict(analytics_metrics),
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

# Deployment Configurations

## Development Environment
```env
# .env.development
XAPI_PUBLISHER_TYPE=kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_XAPI_TOPIC=nlj.xapi.statements
```

## Staging Environment
```env
# .env.staging  
XAPI_PUBLISHER_TYPE=multi
KAFKA_BOOTSTRAP_SERVERS=staging-kafka:9092
KAFKA_XAPI_TOPIC=nlj.xapi.statements
XAPI_LRS_ENDPOINT=http://staging-ralph:8100/xapi
XAPI_LRS_USERNAME=staging_user
XAPI_LRS_PASSWORD=staging_pass
```

## Production Environment
```env
# .env.production
XAPI_PUBLISHER_TYPE=kafka
KAFKA_BOOTSTRAP_SERVERS=prod-kafka-1:9092,prod-kafka-2:9092,prod-kafka-3:9092
KAFKA_XAPI_TOPIC=nlj.xapi.statements
```

---

# Operational Benefits

## **Lightweight Main Application**
- **No LRS dependencies** in core docker-compose
- **No Elasticsearch** in main application stack
- **Minimal code changes** - only publisher abstraction added
- **Fast deployments** - core app deploys independently of LRS infrastructure

## **LRS Vendor Flexibility**
```python
# Switch LRS vendor with configuration change
XAPI_PUBLISHER_TYPE=http
XAPI_LRS_ENDPOINT=https://scorm-cloud.rusticisoftware.com/xapi
# OR
XAPI_PUBLISHER_TYPE=http  
XAPI_LRS_ENDPOINT=https://watershed.com/api/xapi
# OR keep using Ralph
XAPI_PUBLISHER_TYPE=kafka  # → Ralph consumer
```

## **Enterprise Integration Ready**
- **Organizational event bus** - Fits into existing Kafka infrastructure
- **Multiple consumers** - Other teams can consume NLJ learning events
- **Event replay** - Can reprocess events for new analytics needs
- **Compliance ready** - Easy to add compliance-focused consumers

## **Operational Independence**
- **LRS scaling** - Scale Ralph/Elasticsearch independently of main app
- **Fault tolerance** - Main app continues working if LRS is down (events queue in Kafka)
- **Maintenance windows** - Can maintain LRS without affecting learning platform
- **Team separation** - Different teams can own LRS vs. learning application

---

# Future Extensions

## **Additional Consumers**
```python
# Easy to add new consumers for different purposes
- RecommendationConsumer  # ML-driven content recommendations
- ComplianceConsumer      # Regulatory reporting  
- NotificationConsumer    # Real-time alerts
- ExportConsumer         # Automated report generation
- IntegrationConsumer    # Push to external systems (CRM, HR, etc.)
```

## **Multi-LRS Support**
```python
# Publish to multiple LRS systems simultaneously
XAPI_PUBLISHER_TYPE=multi
# Events go to both Kafka AND HTTP LRS
```

## **Advanced Analytics**
```python
# Real-time stream processing with Kafka Streams
- Knowledge gap identification
- Learning path optimization  
- Predictive analytics
- A/B testing frameworks
```

---

# Conclusion

This **decoupled, Kafka-first approach** provides:

- ✅ **Immediate implementation** (2 weeks vs 2-3 months for integrated)
- ✅ **Lightweight application** architecture 
- ✅ **Enterprise-grade scalability** through Kafka
- ✅ **LRS vendor independence** 
- ✅ **Organizational alignment** with event-driven architecture
- ✅ **Future-proof design** that grows with requirements

Your existing **exceptional xAPI implementation** (1,200+ lines) remains completely unchanged - we simply abstract where the events are published. This approach delivers enterprise Learning Record Store capabilities while maintaining clean separation of concerns and operational flexibility.

The combination of your comprehensive xAPI foundation + decoupled event architecture creates a best-in-class learning analytics platform that can evolve with organizational needs.