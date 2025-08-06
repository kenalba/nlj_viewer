"""
Kafka service for event-driven communication.
Handles xAPI event production and consumption for Cal.com integration.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import uuid4

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError

from app.core.config import settings

logger = logging.getLogger(__name__)


class KafkaService:
    """
    Kafka service for handling event-driven communication between NLJ platform and Cal.com.
    Implements xAPI event patterns for learning analytics consistency.
    """
    
    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.bootstrap_servers = settings.KAFKA_BOOTSTRAP_SERVERS
        self.client_id = settings.KAFKA_CLIENT_ID
        self.is_connected = False
    
    async def start_producer(self) -> None:
        """Initialize and start Kafka producer."""
        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                client_id=f"{self.client_id}-producer",
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                # Reliability settings
                acks='all',  # Wait for all replicas to acknowledge
                retry_backoff_ms=1000,
                # Performance settings
                compression_type='gzip',
                max_batch_size=16384,
                linger_ms=10,
            )
            await self.producer.start()
            self.is_connected = True
            logger.info(f"Kafka producer connected to {self.bootstrap_servers}")
        except Exception as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            raise
    
    async def start_consumer(self, topics: List[str], group_id: str) -> None:
        """Initialize and start Kafka consumer for specified topics."""
        try:
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=self.bootstrap_servers,
                client_id=f"{self.client_id}-consumer",
                group_id=group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                key_deserializer=lambda k: k.decode('utf-8') if k else None,
                # Consumer settings
                enable_auto_commit=settings.KAFKA_ENABLE_AUTO_COMMIT,
                auto_commit_interval_ms=settings.KAFKA_AUTO_COMMIT_INTERVAL_MS,
                auto_offset_reset='earliest',
            )
            await self.consumer.start()
            logger.info(f"Kafka consumer connected to topics: {topics}")
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            raise
    
    async def stop(self) -> None:
        """Stop producer and consumer connections."""
        try:
            if self.producer:
                await self.producer.stop()
                logger.info("Kafka producer stopped")
            
            if self.consumer:
                await self.consumer.stop()
                logger.info("Kafka consumer stopped")
            
            self.is_connected = False
        except Exception as e:
            logger.error(f"Error stopping Kafka connections: {e}")
    
    async def publish_event(
        self,
        topic: str,
        event: Dict[str, Any],
        key: Optional[str] = None
    ) -> None:
        """
        Publish an event to a Kafka topic.
        
        Args:
            topic: Kafka topic name
            event: Event data to publish
            key: Optional partition key
        """
        if not self.producer or not self.is_connected:
            raise RuntimeError("Kafka producer not initialized. Call start_producer() first.")
        
        try:
            # Add metadata to event
            enriched_event = {
                **event,
                "producer_id": self.client_id,
                "producer_timestamp": datetime.now(timezone.utc).isoformat(),
                "event_id": key or str(uuid4())
            }
            
            await self.producer.send_and_wait(
                topic=topic,
                value=enriched_event,
                key=key
            )
            
            logger.debug(f"Published event to topic '{topic}': {key}")
            
        except KafkaError as e:
            logger.error(f"Failed to publish event to topic '{topic}': {e}")
            raise
    
    async def consume_events(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Consume events from subscribed topics.
        
        Yields:
            Event data from Kafka topics
        """
        if not self.consumer:
            raise RuntimeError("Kafka consumer not initialized. Call start_consumer() first.")
        
        try:
            async for message in self.consumer:
                yield {
                    "topic": message.topic,
                    "partition": message.partition,
                    "offset": message.offset,
                    "key": message.key,
                    "value": message.value,
                    "timestamp": message.timestamp,
                    "timestamp_type": message.timestamp_type
                }
        except KafkaError as e:
            logger.error(f"Error consuming events: {e}")
            raise


class XAPIEventService:
    """
    Service for creating and publishing xAPI-compliant events for learning analytics.
    Integrates with KafkaService for event distribution.
    """
    
    def __init__(self, kafka_service: KafkaService):
        self.kafka = kafka_service
    
    async def publish_training_session_scheduled(
        self,
        session_id: str,
        session_title: str,
        instructor_email: str,
        instructor_name: str,
        cal_event_id: str,  
        capacity: int,
        location: Optional[str] = None,
        prerequisites: Optional[List[str]] = None
    ) -> None:
        """Publish a training session scheduled event using xAPI standards."""
        
        # Use a custom verb for scheduling since it's not in standard xAPI verbs
        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": instructor_name,
                "mbox": f"mailto:{instructor_email}"
            },
            "verb": {
                "id": "http://activitystrea.ms/schema/1.0/schedule",
                "display": {"en-US": "scheduled"}
            },
            "object": {
                "objectType": "Activity", 
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title},
                    "description": {"en-US": f"Training session: {session_title}"},
                    "type": "http://adlnet.gov/expapi/activities/meeting"
                }
            },
            "context": {
                "instructor": {
                    "objectType": "Agent",
                    "name": instructor_name,
                    "mbox": f"mailto:{instructor_email}"
                },
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/cal_event_id": cal_event_id,
                    "http://nlj.platform/extensions/capacity": capacity,
                    "http://nlj.platform/extensions/location": location or "",
                    "http://nlj.platform/extensions/prerequisites": prerequisites or []
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.kafka.publish_event(
            topic="nlj.training.scheduled",
            event=event,
            key=session_id
        )
    
    async def publish_learner_registration(
        self,
        session_id: str,
        session_title: str,
        learner_email: str,
        learner_name: str,
        cal_booking_id: str,
        scheduled_time: datetime,
        registration_method: str = "online"
    ) -> None:
        """Publish a learner registration event using xAPI standards."""
        
        event = {
            "id": str(uuid4()),
            "version": "1.0.3", 
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}"
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/registered",
                "display": {"en-US": "registered"}
            },
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title},
                    "type": "http://adlnet.gov/expapi/activities/meeting"
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/cal_booking_id": cal_booking_id,
                    "http://nlj.platform/extensions/scheduled_time": scheduled_time.isoformat(),
                    "http://nlj.platform/extensions/registration_method": registration_method
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.kafka.publish_event(
            topic="nlj.training.registration",
            event=event,
            key=f"{session_id}:{learner_email}"
        )
    
    async def publish_session_attendance(
        self,
        learner_email: str,
        learner_name: str,
        session_id: str,
        session_name: str,
        attended: bool,
        duration_minutes: Optional[int] = None,
        attendance_method: str = "in_person",
        check_in_time: Optional[datetime] = None,
        check_out_time: Optional[datetime] = None
    ) -> None:
        """Publish a session attendance event."""
        
        result_data = {
            "completion": attended,
        }
        
        extensions = {
            "http://nlj.platform/extensions/attendance_method": attendance_method
        }
        
        if duration_minutes:
            # ISO 8601 duration format
            result_data["duration"] = f"PT{duration_minutes}M"
        
        if check_in_time:
            extensions["http://nlj.platform/extensions/check_in_time"] = check_in_time.isoformat()
        
        if check_out_time:
            extensions["http://nlj.platform/extensions/check_out_time"] = check_out_time.isoformat()
        
        if extensions:
            result_data["extensions"] = extensions
        
        event = {
            "actor": {
                "name": learner_name,
                "mbox": f"mailto:{learner_email}"
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/attended",
                "display": {"en": "attended"}
            },
            "object": {
                "id": session_id,
                "definition": {
                    "name": {"en": session_name},
                    "type": "http://id.tincanapi.com/activitytype/meeting"
                }
            },
            "result": result_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.kafka.publish_event(
            topic="nlj.training.attendance",
            event=event,
            key=f"{session_id}:{learner_email}"
        )


# Global Kafka service instance
kafka_service = KafkaService()
xapi_event_service = XAPIEventService(kafka_service)


# Dependency injection functions for FastAPI
async def get_kafka_service() -> KafkaService:
    """Get Kafka service instance for dependency injection."""
    return kafka_service


async def get_xapi_event_service() -> XAPIEventService:
    """Get xAPI event service instance for dependency injection."""
    return xapi_event_service