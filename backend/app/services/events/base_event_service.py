"""
Base Kafka service for event-driven communication.
Core infrastructure shared by all event services.
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


class BaseKafkaService:
    """
    Base Kafka service for handling event-driven communication.
    Implements core Kafka producer/consumer functionality.
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
            logger.info("Kafka producer started successfully")
        except Exception as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            self.is_connected = False
            raise

    async def stop_producer(self) -> None:
        """Stop Kafka producer."""
        if self.producer:
            try:
                await self.producer.stop()
                logger.info("Kafka producer stopped")
            except Exception as e:
                logger.error(f"Error stopping Kafka producer: {e}")
            finally:
                self.producer = None
                self.is_connected = False

    async def start_consumer(self, topics: List[str], group_id: str = None) -> None:
        """Initialize and start Kafka consumer."""
        try:
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=self.bootstrap_servers,
                client_id=f"{self.client_id}-consumer",
                group_id=group_id or f"{self.client_id}-group",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                key_deserializer=lambda k: k.decode("utf-8") if k else None,
                # Consumer settings
                auto_offset_reset="latest",
                enable_auto_commit=True,
                auto_commit_interval_ms=5000,
                max_poll_records=500,
                fetch_max_wait_ms=500,
            )
            await self.consumer.start()
            logger.info(f"Kafka consumer started for topics: {topics}")
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            raise

    async def stop_consumer(self) -> None:
        """Stop Kafka consumer."""
        if self.consumer:
            try:
                await self.consumer.stop()
                logger.info("Kafka consumer stopped")
            except Exception as e:
                logger.error(f"Error stopping Kafka consumer: {e}")
            finally:
                self.consumer = None

    async def publish_event(
        self, 
        topic: str, 
        event: Dict[str, Any], 
        key: str = None, 
        validate: bool = True
    ) -> None:
        """Publish an event to a Kafka topic."""
        if not self.producer:
            logger.warning("Kafka producer not initialized, skipping event publication")
            return

        # Add metadata if not present
        if "timestamp" not in event:
            event["timestamp"] = datetime.now(timezone.utc).isoformat()
        if "id" not in event:
            event["id"] = str(uuid4())

        # Validate event if requested
        if validate:
            # Extract event type from topic for validation
            event_type = topic.split('.')[-1] if '.' in topic else topic
            errors = get_event_validation_errors(event_type, event)
            if errors:
                logger.warning(f"Event validation warnings: {errors}")

        try:
            await self.producer.send_and_wait(topic, value=event, key=key)
            logger.debug(f"Event published to topic '{topic}': {event.get('id', 'unknown')}")
        except KafkaError as e:
            logger.error(f"Failed to publish event to topic '{topic}': {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error publishing event: {e}")
            raise

    async def consume_events(self, batch_size: int = 100) -> AsyncGenerator[Dict[str, Any], None]:
        """Consume events from Kafka topics."""
        if not self.consumer:
            logger.error("Kafka consumer not initialized")
            return

        try:
            async for message in self.consumer:
                try:
                    event_data = {
                        "topic": message.topic,
                        "partition": message.partition,
                        "offset": message.offset,
                        "key": message.key,
                        "value": message.value,
                        "timestamp": message.timestamp,
                    }
                    yield event_data
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    continue
        except Exception as e:
            logger.error(f"Error consuming events: {e}")
            raise

    async def get_topic_metadata(self, topics: List[str]) -> Dict[str, Any]:
        """Get metadata for specified topics."""
        if not self.producer:
            await self.start_producer()

        try:
            metadata = await self.producer.client.fetch_metadata(topics)
            return {
                "brokers": [{"id": broker.nodeId, "host": broker.host, "port": broker.port} 
                           for broker in metadata.brokers],
                "topics": {
                    topic: {
                        "partitions": len(topic_meta.partitions),
                        "replicas": topic_meta.partitions[0].replicas if topic_meta.partitions else []
                    } 
                    for topic, topic_meta in metadata.topics.items()
                }
            }
        except Exception as e:
            logger.error(f"Error fetching topic metadata: {e}")
            return {}

    async def health_check(self) -> Dict[str, Any]:
        """Check Kafka service health."""
        health_status = {
            "kafka_connected": self.is_connected,
            "producer_ready": self.producer is not None,
            "consumer_ready": self.consumer is not None,
            "bootstrap_servers": self.bootstrap_servers,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if self.producer:
            try:
                # Test connection by fetching metadata
                await self.get_topic_metadata(["health-check"])
                health_status["connection_test"] = "passed"
            except Exception as e:
                health_status["connection_test"] = f"failed: {e}"
                health_status["kafka_connected"] = False

        return health_status


# Global instance
_kafka_service = BaseKafkaService()


async def get_kafka_service() -> BaseKafkaService:
    """Get the global Kafka service instance."""
    if not _kafka_service.is_connected:
        await _kafka_service.start_producer()
    return _kafka_service