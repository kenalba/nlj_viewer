"""
Kafka to Ralph LRS Consumer Service.
Processes xAPI events from Kafka topics and stores them in Ralph LRS for analytics.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from app.services.kafka_service import KafkaService, get_kafka_service
from app.services.ralph_lrs_service import RalphLRSService, get_ralph_lrs_service

logger = logging.getLogger(__name__)


class KafkaRalphConsumer:
    """
    Consumer service that processes Kafka events and forwards them to Ralph LRS.
    Handles the pipeline: Kafka Topics → xAPI Statements → Ralph LRS → Elasticsearch
    """

    def __init__(self, kafka_service: KafkaService, ralph_service: RalphLRSService):
        self.kafka = kafka_service
        self.ralph = ralph_service
        self.is_running = False
        self.consumer_task = None

        # Topics to consume from
        self.topics = [
            "xapi-events",  # Direct xAPI events from analytics
            "nlj.training.programs",
            "nlj.training.sessions",
            "nlj.training.bookings",
            "nlj.training.attendance",
            "nlj.training.certificates",
            "nlj.training.conflicts",
            "nlj.activity.events",  # Frontend activity events
            "nlj.review.workflow",  # Review workflow events
            "nlj.survey.responses",  # Survey response events (already xAPI formatted)
        ]

    async def start_consuming(self) -> None:
        """Start the Kafka consumer and begin processing events"""
        if self.is_running:
            logger.warning("Kafka Ralph consumer is already running")
            return

        try:
            # Start Kafka consumer with our topics
            await self.kafka.start_consumer(topics=self.topics, group_id="nlj-ralph-lrs-consumer")

            self.is_running = True
            logger.info(f"Started Kafka Ralph consumer for topics: {self.topics}")

            # Start consuming in background
            self.consumer_task = asyncio.create_task(self._consume_events())

        except Exception as e:
            logger.error(f"Failed to start Kafka Ralph consumer: {e}")
            self.is_running = False
            raise

    async def stop_consuming(self) -> None:
        """Stop the Kafka consumer"""
        self.is_running = False

        if self.consumer_task:
            self.consumer_task.cancel()
            try:
                await self.consumer_task
            except asyncio.CancelledError:
                pass

        await self.kafka.stop()
        logger.info("Stopped Kafka Ralph consumer")

    async def process_xapi_statement(self, statement: Dict[str, Any]) -> None:
        """
        Process a single xAPI statement directly.
        This method allows direct submission of xAPI statements for processing.
        """
        try:
            if self._is_xapi_statement(statement):
                await self._forward_xapi_statement(statement)
                logger.debug(f"Processed xAPI statement: {statement.get('id', 'unknown')}")
            else:
                logger.error(f"Invalid xAPI statement format: missing required fields")
                raise ValueError("Statement must contain actor, verb, and object fields")
        except Exception as e:
            logger.error(f"Error processing xAPI statement: {e}")
            raise

    async def _consume_events(self) -> None:
        """Main event consumption loop"""
        try:
            async for message in self.kafka.consume_events():
                if not self.is_running:
                    break

                try:
                    await self._process_message(message)
                except Exception as e:
                    logger.error(f"Error processing Kafka message: {e}")
                    # Continue processing other messages
                    continue

        except asyncio.CancelledError:
            logger.info("Kafka Ralph consumer cancelled")
        except Exception as e:
            logger.error(f"Error in Kafka Ralph consumer loop: {e}")
            self.is_running = False

    async def _process_message(self, message: Dict[str, Any]) -> None:
        """Process a single Kafka message and forward to Ralph LRS"""
        topic = message.get("topic")
        value = message.get("value", {})

        logger.debug(f"Processing message from topic '{topic}': {message.get('key')}")

        try:
            # Check if this is already an xAPI statement
            if self._is_xapi_statement(value):
                # Direct xAPI statement - forward to Ralph LRS
                await self._forward_xapi_statement(value)
            else:
                # Convert event to xAPI statement first
                xapi_statement = await self._convert_to_xapi_statement(topic, value)
                if xapi_statement:
                    await self._forward_xapi_statement(xapi_statement)
                else:
                    logger.debug(f"No xAPI conversion available for topic '{topic}'")

        except Exception as e:
            logger.error(f"Error processing message from topic '{topic}': {e}")
            raise

    def _is_xapi_statement(self, data: Dict[str, Any]) -> bool:
        """Check if data is already a valid xAPI statement"""
        required_fields = ["actor", "verb", "object"]
        return all(field in data for field in required_fields)

    async def _forward_xapi_statement(self, statement: Dict[str, Any]) -> None:
        """Forward xAPI statement to Ralph LRS"""
        try:
            # Ensure statement has required fields
            if "id" not in statement:
                statement["id"] = str(uuid4())

            if "timestamp" not in statement:
                statement["timestamp"] = datetime.now(timezone.utc).isoformat()

            if "version" not in statement:
                statement["version"] = "1.0.3"

            # Store in Ralph LRS
            result = await self.ralph.store_statement(statement)

            if result.get("success"):
                logger.debug(f"Successfully stored statement {statement['id']} in Ralph LRS")
            else:
                logger.error(f"Failed to store statement in Ralph LRS: {result}")

        except Exception as e:
            logger.error(f"Error forwarding xAPI statement to Ralph LRS: {e}")
            raise

    async def _convert_to_xapi_statement(self, topic: str, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert Kafka event to xAPI statement based on topic and content"""

        # Training program events
        if topic == "nlj.training.programs":
            return self._convert_program_event(event)

        # Training session events
        elif topic == "nlj.training.sessions":
            return self._convert_session_event(event)

        # Booking/registration events
        elif topic == "nlj.training.bookings":
            return self._convert_booking_event(event)

        # Attendance events
        elif topic == "nlj.training.attendance":
            return self._convert_attendance_event(event)

        # Certificate events
        elif topic == "nlj.training.certificates":
            return self._convert_certificate_event(event)

        # Activity events (from frontend)
        elif topic == "nlj.activity.events":
            return self._convert_activity_event(event)

        # Review workflow events
        elif topic == "nlj.review.workflow":
            return self._convert_review_event(event)

        # Survey response events (should already be xAPI formatted)
        elif topic == "nlj.survey.responses":
            # Survey events are generated as proper xAPI statements, no conversion needed
            # They should be handled by _is_xapi_statement() check above
            logger.debug(f"Survey response event should already be xAPI formatted: {event.get('id', 'unknown')}")
            return None

        else:
            logger.debug(f"No converter available for topic: {topic}")
            return None

    def _convert_program_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert training program event to xAPI statement"""
        # If it's already an xAPI statement, return as-is
        if self._is_xapi_statement(event):
            return event

        # Extract program information
        program_id = event.get("program_id")
        program_title = event.get("program_title", "Unknown Program")
        creator_info = event.get("creator", {})

        if not program_id or not creator_info:
            logger.debug("Insufficient data for program event conversion")
            return None

        # Determine verb based on event type or existing verb
        verb_id = event.get("verb", {}).get("id")
        if not verb_id:
            # Fallback logic based on event content
            if event.get("event_type") == "created":
                verb_id = "http://adlnet.gov/expapi/verbs/authored"
            elif event.get("event_type") == "published":
                verb_id = "http://adlnet.gov/expapi/verbs/shared"
            else:
                verb_id = "http://adlnet.gov/expapi/verbs/authored"

        return {
            "id": event.get("id", str(uuid4())),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": creator_info.get("name", "Unknown"),
                "mbox": f"mailto:{creator_info.get('email', 'unknown@example.com')}",
                "account": {"name": creator_info.get("id", "unknown"), "homePage": "http://nlj.platform"},
            },
            "verb": {"id": verb_id, "display": {"en-US": verb_id.split("/")[-1]}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-programs/{program_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": event.get("description", "Training program")},
                    "type": "http://adlnet.gov/expapi/activities/course",
                },
            },
            "context": {"platform": "NLJ Platform", "extensions": event.get("context", {}).get("extensions", {})},
            "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

    def _convert_session_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert training session event to xAPI statement"""
        if self._is_xapi_statement(event):
            return event

        session_id = event.get("session_id")
        session_title = event.get("session_title", "Training Session")
        scheduler_info = event.get("scheduler", {})

        if not session_id or not scheduler_info:
            return None

        return {
            "id": event.get("id", str(uuid4())),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": scheduler_info.get("name", "Unknown"),
                "mbox": f"mailto:{scheduler_info.get('email', 'unknown@example.com')}",
                "account": {"name": scheduler_info.get("id", "unknown"), "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://activitystrea.ms/schema/1.0/schedule", "display": {"en-US": "scheduled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {"name": {"en-US": session_title}, "type": "http://adlnet.gov/expapi/activities/meeting"},
            },
            "context": {"platform": "NLJ Platform", "extensions": event.get("context", {}).get("extensions", {})},
            "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

    def _convert_booking_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert booking/registration event to xAPI statement"""
        if self._is_xapi_statement(event):
            return event

        booking_id = event.get("booking_id")
        session_id = event.get("session_id")
        learner_info = event.get("learner", {})

        if not booking_id or not session_id or not learner_info:
            return None

        # Determine verb based on booking status
        verb_mapping = {
            "requested": "http://adlnet.gov/expapi/verbs/asked",
            "confirmed": "http://adlnet.gov/expapi/verbs/registered",
            "waitlisted": "http://nlj.platform/verbs/waitlisted",
            "cancelled": "http://adlnet.gov/expapi/verbs/voided",
        }

        status = event.get("status", "requested")
        verb_id = verb_mapping.get(status, "http://adlnet.gov/expapi/verbs/registered")

        return {
            "id": event.get("id", str(uuid4())),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_info.get("name", "Unknown"),
                "mbox": f"mailto:{learner_info.get('email', 'unknown@example.com')}",
                "account": {"name": learner_info.get("id", "unknown"), "homePage": "http://nlj.platform"},
            },
            "verb": {"id": verb_id, "display": {"en-US": status}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": event.get("session_title", "Training Session")},
                    "type": "http://adlnet.gov/expapi/activities/meeting",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    **(event.get("context", {}).get("extensions", {})),
                },
            },
            "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

    def _convert_attendance_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert attendance event to xAPI statement"""
        if self._is_xapi_statement(event):
            return event

        session_id = event.get("session_id")
        learner_info = event.get("learner", {})

        if not session_id or not learner_info:
            return None

        # Determine verb and result based on attendance type
        event_type = event.get("event_type", "attended")

        if event_type == "checked_in":
            verb_id = "http://nlj.platform/verbs/checked-in"
            result = None
        elif event_type == "completed":
            verb_id = "http://adlnet.gov/expapi/verbs/attended"
            result = {
                "completion": event.get("completion_percentage", 0) >= 80,
                "score": {"scaled": event.get("attendance_score")} if event.get("attendance_score") else None,
            }
        else:
            verb_id = "http://adlnet.gov/expapi/verbs/attended"
            result = {"completion": event.get("attended", True)}

        statement = {
            "id": event.get("id", str(uuid4())),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_info.get("name", "Unknown"),
                "mbox": f"mailto:{learner_info.get('email', 'unknown@example.com')}",
                "account": {"name": learner_info.get("id", "unknown"), "homePage": "http://nlj.platform"},
            },
            "verb": {"id": verb_id, "display": {"en-US": event_type.replace("_", " ")}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": event.get("session_title", "Training Session")},
                    "type": "http://adlnet.gov/expapi/activities/meeting",
                },
            },
            "context": {"platform": "NLJ Platform", "extensions": event.get("context", {}).get("extensions", {})},
            "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

        if result:
            statement["result"] = result

        return statement

    def _convert_certificate_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert certificate event to xAPI statement"""
        if self._is_xapi_statement(event):
            return event

        # Certificate events are likely already properly formatted
        # This is a fallback converter
        return None

    def _convert_activity_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert frontend activity event to xAPI statement"""
        if self._is_xapi_statement(event):
            return event

        # Frontend activity events should already be xAPI formatted
        # This handles any legacy or malformed events
        activity_id = event.get("activity_id") or event.get("object", {}).get("id")
        actor_info = event.get("actor") or event.get("learner", {})

        if not activity_id or not actor_info:
            return None

        return {
            "id": event.get("id", str(uuid4())),
            "version": "1.0.3",
            "actor": actor_info,
            "verb": event.get(
                "verb", {"id": "http://adlnet.gov/expapi/verbs/experienced", "display": {"en-US": "experienced"}}
            ),
            "object": {
                "objectType": "Activity",
                "id": activity_id,
                "definition": event.get("object", {}).get(
                    "definition",
                    {"name": {"en-US": "Learning Activity"}, "type": "http://adlnet.gov/expapi/activities/interaction"},
                ),
            },
            "result": event.get("result"),
            "context": event.get("context", {"platform": "NLJ Platform"}),
            "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

    def _convert_review_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert review workflow event to xAPI statement"""
        if self._is_xapi_statement(event):
            return event

        # Review events might not need xAPI conversion
        # They're more internal workflow events
        return None


# Global consumer service instance
kafka_ralph_consumer = None


async def get_kafka_ralph_consumer() -> KafkaRalphConsumer:
    """Get Kafka Ralph consumer instance"""
    global kafka_ralph_consumer

    if kafka_ralph_consumer is None:
        kafka_service = await get_kafka_service()
        ralph_service = await get_ralph_lrs_service()
        kafka_ralph_consumer = KafkaRalphConsumer(kafka_service, ralph_service)

    return kafka_ralph_consumer


async def start_kafka_ralph_consumer() -> None:
    """Start the Kafka Ralph consumer service"""
    consumer = await get_kafka_ralph_consumer()
    await consumer.start_consuming()


async def stop_kafka_ralph_consumer() -> None:
    """Stop the Kafka Ralph consumer service"""
    if kafka_ralph_consumer:
        await kafka_ralph_consumer.stop_consuming()
