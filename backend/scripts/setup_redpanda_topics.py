#!/usr/bin/env python3
"""
Setup RedPanda topics for NLJ training scheduling event-driven architecture.
Creates all required topics with appropriate configurations.
RedPanda is Kafka API compatible, so we use the same aiokafka admin client.
"""

import asyncio
import logging
import sys
from typing import Dict, List

# Import Kafka libraries - they work with RedPanda too
try:
    from aiokafka.admin import AIOKafkaAdminClient
    from aiokafka.admin.new_topic import NewTopic
    from aiokafka.errors import TopicAlreadyExistsError

    REDPANDA_AVAILABLE = True
except ImportError:
    REDPANDA_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Topic configurations - same as original Kafka setup
TRAINING_TOPICS = {
    # Program lifecycle events
    "nlj.training.programs": {
        "description": "Training program lifecycle events (created, published, updated)",
        "partitions": 3,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Session scheduling events
    "nlj.training.sessions": {
        "description": "Training session lifecycle events (scheduled, cancelled, rescheduled)",
        "partitions": 6,  # Higher throughput for session operations
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Booking and registration events
    "nlj.training.bookings": {
        "description": "Training booking events (requested, confirmed, cancelled, waitlisted)",
        "partitions": 12,  # High throughput for booking operations
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Attendance tracking events
    "nlj.training.attendance": {
        "description": "Training attendance events (checked-in, attended, completed)",
        "partitions": 6,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Conflict detection and resolution
    "nlj.training.conflicts": {
        "description": "Training scheduling conflict events (time, location, instructor conflicts)",
        "partitions": 3,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Certificate and completion events
    "nlj.training.certificates": {
        "description": "Training certificate and completion events",
        "partitions": 3,
        "replication_factor": 1,
        "config": {
            "retention.ms": "7776000000",  # 90 days - longer retention for certificates
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
    # xAPI events from NLJ activities (legacy compatibility)
    "nlj.xapi.statements": {
        "description": "xAPI statements from NLJ learning activities",
        "partitions": 6,
        "replication_factor": 1,
        "config": {
            "retention.ms": "7776000000",  # 90 days - longer retention for learning analytics
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
    # Content workflow events
    "nlj.content.workflow": {
        "description": "Content creation and approval workflow events",
        "partitions": 3,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
}


class RedPandaTopicManager:
    """Manager for creating and configuring RedPanda topics."""

    def __init__(self, bootstrap_servers: str = "localhost:9092"):
        self.bootstrap_servers = bootstrap_servers
        self.admin_client = None

    async def connect(self) -> bool:
        """Connect to RedPanda cluster."""
        if not REDPANDA_AVAILABLE:
            logger.error("aiokafka library not available. Install with: pip install aiokafka")
            return False

        try:
            self.admin_client = AIOKafkaAdminClient(
                bootstrap_servers=self.bootstrap_servers, client_id="nlj-redpanda-admin"
            )
            await self.admin_client.start()
            logger.info(f"Connected to RedPanda cluster: {self.bootstrap_servers}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to RedPanda: {e}")
            return False

    async def disconnect(self):
        """Disconnect from RedPanda cluster."""
        if self.admin_client:
            await self.admin_client.close()
            logger.info("Disconnected from RedPanda cluster")

    async def create_topic(self, topic_name: str, topic_config: Dict) -> bool:
        """Create a single topic with configuration."""
        if not self.admin_client:
            logger.error("Not connected to RedPanda. Call connect() first.")
            return False

        try:
            new_topic = NewTopic(
                name=topic_name,
                num_partitions=topic_config["partitions"],
                replication_factor=topic_config["replication_factor"],
                topic_configs=topic_config.get("config", {}),
            )

            await self.admin_client.create_topics([new_topic])
            logger.info(
                f"✓ Created topic '{topic_name}' "
                f"(partitions: {topic_config['partitions']}, "
                f"replication: {topic_config['replication_factor']})"
            )
            return True

        except TopicAlreadyExistsError:
            logger.info(f"✓ Topic '{topic_name}' already exists")
            return True

        except Exception as e:
            logger.error(f"✗ Failed to create topic '{topic_name}': {e}")
            return False

    async def create_all_topics(self) -> bool:
        """Create all training system topics."""
        logger.info("Creating NLJ training system topics in RedPanda...")

        success_count = 0
        total_topics = len(TRAINING_TOPICS)

        for topic_name, topic_config in TRAINING_TOPICS.items():
            logger.info(f"Creating topic: {topic_name} - {topic_config['description']}")

            if await self.create_topic(topic_name, topic_config):
                success_count += 1
            else:
                logger.error(f"Failed to create topic: {topic_name}")

        logger.info(f"Topic creation complete: {success_count}/{total_topics} successful")
        return success_count == total_topics

    async def list_topics(self) -> List[str]:
        """List all topics in the RedPanda cluster."""
        if not self.admin_client:
            logger.error("Not connected to RedPanda. Call connect() first.")
            return []

        try:
            cluster_metadata = await self.admin_client.describe_cluster()
            topics = list(cluster_metadata.topics)
            logger.info(f"Found {len(topics)} topics in RedPanda cluster")
            return topics

        except Exception as e:
            logger.error(f"Failed to list topics: {e}")
            return []

    async def verify_topics(self) -> bool:
        """Verify all required topics exist."""
        existing_topics = await self.list_topics()

        missing_topics = []
        for topic_name in TRAINING_TOPICS.keys():
            if topic_name not in existing_topics:
                missing_topics.append(topic_name)

        if missing_topics:
            logger.warning(f"Missing topics: {missing_topics}")
            return False
        else:
            logger.info("✓ All required topics exist in RedPanda")
            return True


async def main():
    """Main function to set up RedPanda topics."""
    if not REDPANDA_AVAILABLE:
        logger.error("aiokafka library not available. Install with: pip install aiokafka")
        sys.exit(1)

    # Default to localhost, but allow override via environment
    import os

    bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

    logger.info("NLJ Platform RedPanda Topic Setup")
    logger.info("=" * 50)
    logger.info(f"RedPanda cluster: {bootstrap_servers}")

    manager = RedPandaTopicManager(bootstrap_servers)

    try:
        # Connect to RedPanda
        if not await manager.connect():
            logger.error("Failed to connect to RedPanda. Is it running?")
            sys.exit(1)

        # Create all topics
        if await manager.create_all_topics():
            logger.info("✓ All topics created successfully")

            # Verify topics exist
            if await manager.verify_topics():
                logger.info("✓ Topic verification passed")
            else:
                logger.warning("⚠ Some topics may be missing")

        else:
            logger.error("✗ Failed to create some topics")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

    finally:
        await manager.disconnect()

    logger.info("RedPanda topic setup complete!")


if __name__ == "__main__":
    asyncio.run(main())
