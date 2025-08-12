"""
Kafka service for event-driven communication.
Handles xAPI event production and consumption for training scheduling system.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import uuid4

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError

from app.core.config import settings
from app.schemas.xapi_events import get_event_validation_errors

logger = logging.getLogger(__name__)


class KafkaService:
    """
    Kafka service for handling event-driven communication.
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
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                # Reliability settings
                acks="all",  # Wait for all replicas to acknowledge
                retry_backoff_ms=1000,
                # Performance settings
                compression_type="gzip",
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
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                key_deserializer=lambda k: k.decode("utf-8") if k else None,
                # Consumer settings
                enable_auto_commit=settings.KAFKA_ENABLE_AUTO_COMMIT,
                auto_commit_interval_ms=settings.KAFKA_AUTO_COMMIT_INTERVAL_MS,
                auto_offset_reset="earliest",
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
        self, topic: str, event: Dict[str, Any], key: Optional[str] = None, validate: bool = True
    ) -> None:
        """
        Publish an event to a Kafka topic.

        Args:
            topic: Kafka topic name
            event: Event data to publish
            key: Optional partition key
            validate: Whether to validate event schema (default: True)
        """
        if not self.producer or not self.is_connected:
            raise RuntimeError("Kafka producer not initialized. Call start_producer() first.")

        try:
            # Optional event validation
            if validate:
                # Extract event type from topic
                event_type = self._extract_event_type(topic, event)
                if event_type:
                    validation_errors = get_event_validation_errors(event_type, event)
                    if validation_errors:
                        logger.warning(f"Event validation failed for {event_type}: " f"{validation_errors}")
                        # Continue publishing but log the warning

            # Add metadata to event
            enriched_event = {
                **event,
                "producer_id": self.client_id,
                "producer_timestamp": datetime.now(timezone.utc).isoformat(),
                "event_id": key or str(uuid4()),
            }

            await self.producer.send_and_wait(topic=topic, value=enriched_event, key=key)

            logger.debug(f"Published event to topic '{topic}': {key}")

        except KafkaError as e:
            logger.error(f"Failed to publish event to topic '{topic}': {e}")
            raise

    def _extract_event_type(self, topic: str, event: Dict[str, Any]) -> Optional[str]:
        """Extract event type from topic and verb for validation."""

        # Map topic + verb to event type
        topic_verb_mapping = {
            ("nlj.training.programs", "http://adlnet.gov/expapi/verbs/authored"): "program.created",
            ("nlj.training.programs", "http://adlnet.gov/expapi/verbs/shared"): "program.published",
            ("nlj.training.sessions", "http://activitystrea.ms/schema/1.0/schedule"): "session.scheduled",
            ("nlj.training.bookings", "http://adlnet.gov/expapi/verbs/asked"): "booking.requested",
            ("nlj.training.bookings", "http://adlnet.gov/expapi/verbs/registered"): "booking.confirmed",
            ("nlj.training.bookings", "http://nlj.platform/verbs/waitlisted"): "booking.waitlisted",
            # Content generation events
            ("nlj.content.generation", "http://adlnet.gov/expapi/verbs/authored"): "content.generation.requested",
            ("nlj.content.generation", "http://adlnet.gov/expapi/verbs/modified"): "content.generation.modified",
            ("nlj.content.generation", "http://adlnet.gov/expapi/verbs/imported"): "content.generation.imported",
            ("nlj.content.generation", "http://adlnet.gov/expapi/verbs/reviewed"): "content.generation.reviewed",
        }

        verb_id = event.get("verb", {}).get("id")
        if verb_id:
            return topic_verb_mapping.get((topic, verb_id))

        return None

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
                    "timestamp_type": message.timestamp_type,
                }
        except KafkaError as e:
            logger.error(f"Error consuming events: {e}")
            raise


class XAPIEventService:
    """
    Service for creating and publishing xAPI-compliant events for learning analytics.
    Handles complete training lifecycle events: programs, sessions, bookings,
    attendance, and integrates with NLJ activity events and review workflow events.
    """

    def __init__(self, kafka_service: KafkaService):
        self.kafka = kafka_service

    # =========================================================================
    # PROGRAM LIFECYCLE EVENTS
    # =========================================================================

    async def publish_program_created(
        self,
        program_id: str,
        program_title: str,
        program_description: str,
        creator_id: str,
        creator_email: str,
        creator_name: str,
        learning_objectives: Optional[List[str]] = None,
        prerequisites: Optional[List[str]] = None,
    ) -> None:
        """Publish a training program created event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": creator_name,
                "mbox": f"mailto:{creator_email}",
                "account": {"name": creator_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "authored"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-programs/{program_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": program_description},
                    "type": "http://adlnet.gov/expapi/activities/course",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/learning_objectives": (learning_objectives or []),
                    "http://nlj.platform/extensions/prerequisites": (prerequisites or []),
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.programs", event=event, key=program_id)

    async def publish_program_published(
        self,
        program_id: str,
        program_title: str,
        publisher_id: str,
        publisher_email: str,
        publisher_name: str,
        target_audience: Optional[str] = None,
    ) -> None:
        """Publish a training program published event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": publisher_name,
                "mbox": f"mailto:{publisher_email}",
                "account": {"name": publisher_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/shared", "display": {"en-US": "published"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-programs/{program_id}",
                "definition": {"name": {"en-US": program_title}, "type": "http://adlnet.gov/expapi/activities/course"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {"http://nlj.platform/extensions/target_audience": (target_audience or "all")},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.programs", event=event, key=program_id)

    # =========================================================================
    # SESSION LIFECYCLE EVENTS
    # =========================================================================

    async def publish_session_scheduled(
        self,
        session_id: str,
        program_id: str,
        session_title: str,
        start_time: datetime,
        end_time: datetime,
        location: Optional[str],
        capacity: int,
        scheduler_id: str,
        scheduler_email: str,
        scheduler_name: str,
        instructor_id: Optional[str] = None,
    ) -> None:
        """Publish a training session scheduled event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": scheduler_name,
                "mbox": f"mailto:{scheduler_email}",
                "account": {"name": scheduler_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://activitystrea.ms/schema/1.0/schedule", "display": {"en-US": "scheduled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/program_id": program_id,
                    "http://nlj.platform/extensions/start_time": (start_time.isoformat()),
                    "http://nlj.platform/extensions/end_time": (end_time.isoformat()),
                    "http://nlj.platform/extensions/location": location or "",
                    "http://nlj.platform/extensions/capacity": capacity,
                    "http://nlj.platform/extensions/instructor_id": instructor_id,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.sessions", event=event, key=session_id)

    # =========================================================================
    # BOOKING & REGISTRATION EVENTS
    # =========================================================================

    async def publish_booking_requested(
        self,
        booking_id: str,
        session_id: str,
        session_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        registration_method: str = "online",
        special_requirements: Optional[Dict] = None,
    ) -> None:
        """Publish a booking requested event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/asked", "display": {"en-US": "requested"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    "http://nlj.platform/extensions/registration_method": (registration_method),
                    "http://nlj.platform/extensions/special_requirements": (special_requirements or {}),
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.bookings", event=event, key=f"{session_id}:{learner_id}")

    async def publish_booking_confirmed(
        self,
        booking_id: str,
        session_id: str,
        session_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        confirmer_id: str,
        confirmation_method: str = "automatic",
    ) -> None:
        """Publish a booking confirmed event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/registered", "display": {"en-US": "registered"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    "http://nlj.platform/extensions/confirmation_method": (confirmation_method),
                    "http://nlj.platform/extensions/confirmed_by": confirmer_id,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.bookings", event=event, key=f"{session_id}:{learner_id}")

    async def publish_booking_waitlisted(
        self,
        booking_id: str,
        session_id: str,
        session_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        waitlist_position: int,
    ) -> None:
        """Publish a booking waitlisted event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://nlj.platform/verbs/waitlisted", "display": {"en-US": "waitlisted"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    "http://nlj.platform/extensions/waitlist_position": waitlist_position,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.bookings", event=event, key=f"{session_id}:{learner_id}")

    # =========================================================================
    # CANCELLATION EVENTS
    # =========================================================================

    async def publish_session_cancelled(
        self,
        session_id: str,
        program_id: str,
        session_title: str,
        canceller_id: str,
        canceller_email: str,
        canceller_name: str,
        cancellation_reason: str,
        cancelled_at: datetime,
        notify_learners: bool = True,
    ) -> None:
        """Publish a training session cancelled event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": canceller_name,
                "mbox": f"mailto:{canceller_email}",
                "account": {"name": canceller_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/voided", "display": {"en-US": "cancelled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/program_id": program_id,
                    "http://nlj.platform/extensions/cancellation_reason": cancellation_reason,
                    "http://nlj.platform/extensions/cancelled_at": cancelled_at.isoformat(),
                    "http://nlj.platform/extensions/notify_learners": notify_learners,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.sessions", event=event, key=session_id)

    async def publish_booking_cancelled(
        self,
        booking_id: str,
        session_id: str,
        session_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        canceller_id: str,
        cancellation_reason: str = "learner_request",
        refund_issued: bool = False,
    ) -> None:
        """Publish a booking cancellation event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/voided", "display": {"en-US": "cancelled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    "http://nlj.platform/extensions/cancelled_by": canceller_id,
                    "http://nlj.platform/extensions/cancellation_reason": cancellation_reason,
                    "http://nlj.platform/extensions/refund_issued": refund_issued,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.bookings", event=event, key=f"{session_id}:{learner_id}")

    # =========================================================================
    # ATTENDANCE EVENTS
    # =========================================================================

    async def publish_attendance_checked_in(
        self,
        session_id: str,
        session_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        check_in_time: datetime,
        check_in_method: str = "manual",
    ) -> None:
        """Publish an attendance check-in event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://nlj.platform/verbs/checked-in", "display": {"en-US": "checked in"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/check_in_time": check_in_time.isoformat(),
                    "http://nlj.platform/extensions/check_in_method": check_in_method,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.attendance", event=event, key=f"{session_id}:{learner_id}")

    async def publish_attendance_completed(
        self,
        session_id: str,
        session_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        completion_percentage: float,
        duration_minutes: int,
        attendance_score: Optional[float] = None,
    ) -> None:
        """Publish an attendance completion event."""

        result_data = {
            "completion": completion_percentage >= 80.0,  # 80% threshold for completion
            "score": {"scaled": attendance_score} if attendance_score else None,
            "duration": f"PT{duration_minutes}M",  # ISO 8601 duration
        }

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/attended", "display": {"en-US": "attended"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "result": result_data,
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/completion_percentage": completion_percentage,
                    "http://nlj.platform/extensions/duration_minutes": duration_minutes,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.attendance", event=event, key=f"{session_id}:{learner_id}")

    # =========================================================================
    # CERTIFICATE EVENTS
    # =========================================================================

    async def publish_certificate_earned(
        self,
        certificate_id: str,
        certificate_name: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        program_id: str,
        session_id: Optional[str] = None,
        completion_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
        certificate_url: Optional[str] = None,
    ) -> None:
        """Publish a certificate earned event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/earned", "display": {"en-US": "earned"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/certificates/{certificate_id}",
                "definition": {
                    "name": {"en-US": certificate_name},
                    "type": "http://adlnet.gov/expapi/activities/badge",
                },
            },
            "result": {"completion": True, "success": True},
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/program_id": program_id,
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/completion_date": (
                        completion_date or datetime.now(timezone.utc)
                    ).isoformat(),
                    "http://nlj.platform/extensions/expiry_date": (expiry_date.isoformat() if expiry_date else None),
                    "http://nlj.platform/extensions/certificate_url": certificate_url,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.certificates", event=event, key=f"{program_id}:{learner_id}")

    # =========================================================================
    # CONTENT GENERATION EVENTS
    # =========================================================================

    async def publish_content_generation_requested(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        source_document_ids: List[str],
        prompt_config: Dict[str, Any],
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation requested event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "requested"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {"extensions": {"http://nlj.platform/extensions/generation_status": "requested"}},
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/source_document_ids": source_document_ids,
                    "http://nlj.platform/extensions/prompt_config": prompt_config,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_started(
        self, session_id: str, user_id: str, user_email: str, user_name: str, session_title: Optional[str] = None
    ) -> None:
        """Publish a content generation started event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "started"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {"extensions": {"http://nlj.platform/extensions/generation_status": "started"}},
            "context": {"platform": "NLJ Platform"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_progress(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        progress_percentage: int,
        current_step: str,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation progress event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "progressing"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/generation_status": "progressing",
                    "http://nlj.platform/extensions/progress_percentage": progress_percentage,
                    "http://nlj.platform/extensions/current_step": current_step,
                }
            },
            "context": {"platform": "NLJ Platform"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_completed(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        generated_content_size: Optional[int] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation completed event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "completed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "completion": True,
                "success": True,
                "extensions": {
                    "http://nlj.platform/extensions/generation_status": "completed",
                    "http://nlj.platform/extensions/generated_content_size": generated_content_size or 0,
                },
            },
            "context": {"platform": "NLJ Platform"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_failed(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        error_message: str,
        error_type: Optional[str] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation failed event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "failed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "completion": False,
                "success": False,
                "extensions": {"http://nlj.platform/extensions/generation_status": "failed"},
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/error_message": error_message,
                    "http://nlj.platform/extensions/error_type": error_type or "unknown",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_modified(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        modification_type: str,  # "manual_edit", "flow_editor_change", "regeneration", "parameter_update"
        modification_description: Optional[str] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation modified event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/modified", "display": {"en-US": "modified"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/modification_type": modification_type,
                    "http://nlj.platform/extensions/modification_description": modification_description or "",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_imported(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        import_source: str,
        import_type: str,  # "trivie_excel", "nlj_json", "external_source", "template"
        imported_items_count: Optional[int] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation imported event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/imported", "display": {"en-US": "imported"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/import_source": import_source,
                    "http://nlj.platform/extensions/import_type": import_type,
                    "http://nlj.platform/extensions/imported_items_count": imported_items_count or 0,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    async def publish_content_generation_reviewed(
        self,
        session_id: str,
        reviewer_id: str,
        reviewer_email: str,
        reviewer_name: str,
        review_status: str,  # "approved", "rejected", "needs_revision", "pending"
        reviewer_comments: Optional[str] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation reviewed event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": reviewer_name,
                "mbox": f"mailto:{reviewer_email}",
                "account": {"name": reviewer_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/reviewed", "display": {"en-US": "reviewed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {"extensions": {"http://nlj.platform/extensions/review_status": review_status}},
            "context": {
                "platform": "NLJ Platform",
                "extensions": {"http://nlj.platform/extensions/reviewer_comments": reviewer_comments or ""},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id)

    # =========================================================================
    # CONFLICT DETECTION EVENTS
    # =========================================================================

    async def publish_scheduling_conflict_detected(
        self,
        conflict_id: str,
        session_id: str,
        conflicting_session_ids: List[str],
        conflict_type: str,  # "time_overlap", "location_conflict", "instructor_conflict"
        conflict_details: Dict[str, Any],
        detected_by: str = "system",
    ) -> None:
        """Publish a scheduling conflict detection event."""

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": "System Scheduler",
                "account": {"name": detected_by, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://nlj.platform/verbs/detected", "display": {"en-US": "detected conflict"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": f"Scheduling Conflict: {conflict_type}"},
                    "type": "http://nlj.platform/activities/scheduling-conflict",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/conflict_id": conflict_id,
                    "http://nlj.platform/extensions/conflict_type": conflict_type,
                    "http://nlj.platform/extensions/conflicting_sessions": conflicting_session_ids,
                    "http://nlj.platform/extensions/conflict_details": conflict_details,
                    "http://nlj.platform/extensions/severity": "medium",  # low, medium, high, critical
                    "http://nlj.platform/extensions/requires_resolution": True,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(topic="nlj.training.conflicts", event=event, key=conflict_id)

    # =========================================================================
    # LEGACY EVENT METHODS (for backwards compatibility)
    # =========================================================================

    async def publish_training_session_scheduled(
        self,
        session_id: str,
        session_title: str,
        instructor_email: str,
        instructor_name: str,
        cal_event_id: str,
        capacity: int,
        location: Optional[str] = None,
        prerequisites: Optional[List[str]] = None,
    ) -> None:
        """Legacy method - use publish_session_scheduled instead."""
        logger.warning(
            "Using legacy method publish_training_session_scheduled. " "Consider using publish_session_scheduled."
        )

        # Use new method with default values
        await self.publish_session_scheduled(
            session_id=session_id,
            program_id="unknown",
            session_title=session_title,
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc),
            location=location,
            capacity=capacity,
            scheduler_id="system",
            scheduler_email=instructor_email,
            scheduler_name=instructor_name,
        )

    async def publish_learner_registration(
        self,
        session_id: str,
        session_title: str,
        learner_email: str,
        learner_name: str,
        cal_booking_id: str,
        scheduled_time: datetime,
        registration_method: str = "online",
    ) -> None:
        """Legacy method - use publish_booking_confirmed instead."""
        logger.warning("Using legacy method publish_learner_registration. " "Consider using publish_booking_confirmed.")

        # Use new method with default values
        await self.publish_booking_confirmed(
            booking_id=cal_booking_id,
            session_id=session_id,
            session_title=session_title,
            learner_id="unknown",
            learner_email=learner_email,
            learner_name=learner_name,
            confirmer_id="system",
            confirmation_method=registration_method,
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
        check_out_time: Optional[datetime] = None,
    ) -> None:
        """Legacy method - will be replaced with new attendance events."""
        logger.warning(
            "Using legacy method publish_session_attendance. " "This will be replaced with specific attendance events."
        )

        result_data = {
            "completion": attended,
        }

        extensions = {"http://nlj.platform/extensions/attendance_method": attendance_method}

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
            "actor": {"name": learner_name, "mbox": f"mailto:{learner_email}"},
            "verb": {"id": "http://adlnet.gov/expapi/verbs/attended", "display": {"en": "attended"}},
            "object": {
                "id": session_id,
                "definition": {"name": {"en": session_name}, "type": "http://id.tincanapi.com/activitytype/meeting"},
            },
            "result": result_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.kafka.publish_event(
            topic="nlj.training.attendance", event=event, key=f"{session_id}:{learner_email}"
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
